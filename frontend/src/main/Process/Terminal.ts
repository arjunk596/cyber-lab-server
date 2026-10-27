import { app, ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import type { IPty } from "node-pty";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { getLabShellEnv } from "./LabEnv";

let pty: IPty | null = null;
let win: BrowserWindow | null = null;
let sessionId = 0;

interface SpawnOptions {
  cols: number
  rows: number
  cwd?: string
}

const shellFor = (): string => process.env.SHELL ?? '/bin/bash';

const safeEnv = (): { [key: string]: string } => {
  const env: { [key: string]: string } = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  for (const [k, v] of Object.entries(getLabShellEnv())) {
    if (v) env[k] = v;
  }
  return env;
};

const resolveCwd = async (requested?: string): Promise<string | null> => {
  const candidates = [
    requested,
    join(app.getPath('userData'), 'repo'),
    app.getPath('userData'),
    process.env.HOME
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const info = await stat(candidate)
      if (info.isDirectory()) return candidate
    } catch {
    }
  }
  return null
}

export const killPtySession = (): void => {
  if (!pty) return;
  const dying = pty
  pty = null
  sessionId += 1
  try {
    dying.kill();
  } catch { }
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(Math.round(value) || min, max))

export const createPtySession = async (opts: SpawnOptions): Promise<boolean> => {
  killPtySession();
  const id = sessionId;

  try {
    const nodePty = await import('node-pty');
    if (id !== sessionId) return false
    const cwd = (await resolveCwd(opts.cwd)) ?? process.cwd()
    if (id !== sessionId) return false
    const child = nodePty.spawn(shellFor(), [], {
      name: 'xterm-256color',
      cols: clamp(opts.cols, 2, 500),
      rows: clamp(opts.rows, 2, 300),
      cwd,
      env: safeEnv()
    });
    pty = child;

    child.onData((data) => {
      if (id !== sessionId) return
      try {
        win?.webContents.send('pty:data', data);
      } catch { }
    });
    child.onExit(() => {
      if (id !== sessionId) return
      pty = null;
      try {
        win?.webContents.send('pty:exit');
      } catch { }
    });
    return true;
  } catch (e) {
    if (id === sessionId) pty = null;
    if (id !== sessionId) return false
    const msg = `\r\n\x1b[31m[terminal unavailable] ${String((e as Error).message ?? e)}\x1b[0m\r\n`;
    try {
      win?.webContents.send('pty:data', msg);
      win?.webContents.send('pty:exit');
    } catch { }
    return false;
  }
};

export const registerTerminalHandlers = (windowRef: () => BrowserWindow | null): void => {
  ipcMain.handle('pty:spawn', (_ev, opts: SpawnOptions) => {
    win = windowRef();
    return createPtySession(opts);
  });
  ipcMain.on('pty:stdin', (_ev, data: string) => pty?.write(data));
  ipcMain.on('pty:resize', (_ev, opts: { cols: number; rows: number }) => {
    if (!pty) return;
    try {
      pty.resize(clamp(opts.cols, 2, 500), clamp(opts.rows, 2, 300));
    } catch { }
  });
  ipcMain.on('pty:kill', () => killPtySession());
};
