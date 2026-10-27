import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import handleInstance from "./Window/Instance";
import windowProperty from "./Window/Property";
import { close, maximize, minimize } from "./Window/Controls";
import { checkDeps, type CmdType } from "./Process/checkDependency";
import { killPtySession, registerTerminalHandlers } from "./Process/Terminal";
import { recoverLabOnBoot, registerLabHandlers, stopLab } from "./Process/Lab";

// Augment PATH with Docker, Homebrew, and system paths on macOS/Linux
const homeDir = process.env.HOME || ''
const extraPaths = [
  join(homeDir, '.docker', 'bin'),
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin'
]
process.env.PATH = `${extraPaths.join(':')}:${process.env.PATH || ''}`

let win: null | BrowserWindow = null;
const lock = app.requestSingleInstanceLock();

const createWindow = () => {
  win = new BrowserWindow(windowProperty);

  win.on('ready-to-show', () => win?.show())

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (!lock) {
  app.quit()
} else {
  app.whenReady().then(() => {
    app.on('second-instance', () => { handleInstance(win as BrowserWindow) })
    createWindow()
    void recoverLabOnBoot()
  })
}

ipcMain.on('win:minimize', () => minimize(win))
ipcMain.on('win:maximize', () => maximize(win))
ipcMain.on('win:close', () => close(win))
ipcMain.handle('proc:checkDependency', (_, cmd: CmdType) => checkDeps(cmd))
ipcMain.handle('open-external-url', (_, url) => shell.openExternal(url))
registerTerminalHandlers(() => win)
registerLabHandlers(() => win)

let shuttingDown = false

app.on('before-quit', (event) => {
  if (shuttingDown) return
  event.preventDefault()
  shuttingDown = true

  killPtySession()

  const guard = new Promise<void>((resolve) => setTimeout(resolve, 20000))
  void Promise.race([stopLab().then(() => undefined), guard])
    .catch(() => undefined)
    .finally(() => app.quit())
})
