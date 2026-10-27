import { app, ipcMain, type BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { LabLog, LabLogStream, LabSnapshot, LabStartOptions, LabStatus } from "../../shared/lab";
import {
  ensureRepoRoot,
  removeRepoDir,
  repoPathFor,
  repoRoot,
  sanitizeRepoName
} from "../Window/RepoDir";
import { killPtySession } from "./Terminal";
import { setLabShellEnv } from "./LabEnv";

interface ComposeRef {
  file: string
  projectDir: string
  project: string
}

interface ActiveSession {
  repoName: string
  repoPath: string
  compose: ComposeRef
  proc: ChildProcess | null
}

interface SavedSession {
  repoName: string
  repoPath: string
  composeFile: string
  projectDir: string
  project: string
}

interface RunOptions {
  cwd?: string
  errorStream?: LabLogStream
  timeoutMs?: number
  onSpawn?: (child: ChildProcess) => void
}


const MAX_LOG_LINES = 400
const COMPOSE_FILES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"]
const COMPOSE_DIRS = ["", "docker", "compose"]

let logBuffer: LabLog[] = []
let lastLogLine = { text: "", at: 0 }
let currentStatus: LabStatus = { phase: "idle" }
let session: ActiveSession | null = null
let activeClone: ChildProcess | null = null
let startPromise: Promise<LabStatus> | null = null
let stopPromise: Promise<LabStatus> | null = null
let generation = 0
let windowRef: (() => BrowserWindow | null) | null = null


const send = (channel: string, payload: unknown): void => {
  try {
    windowRef?.()?.webContents.send(channel, payload)
  } catch {
  }
}

const stripAnsi = (text: string): string =>
  text
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")

const pushLog = (stream: LabLogStream, text: string): void => {
  for (const raw of stripAnsi(text).split(/\r\n|\r|\n/)) {
    const line = raw.trimEnd()
    if (!line.trim()) continue

    const now = Date.now()
    if (line === lastLogLine.text && now - lastLogLine.at < 500) {
      lastLogLine.at = now
      continue
    }
    lastLogLine = { text: line, at: now }

    const entry: LabLog = { stream, line }
    logBuffer.push(entry)
    if (logBuffer.length > MAX_LOG_LINES) {
      logBuffer.splice(0, logBuffer.length - MAX_LOG_LINES)
    }
    send("lab:log", entry)
  }
}

const setStatus = (next: LabStatus): LabStatus => {
  currentStatus = next
  send("lab:status", next)
  return next
}

const stateFilePath = (): string => join(app.getPath("userData"), "lab-session.json")

const saveSessionState = async (state: SavedSession): Promise<void> => {
  try {
    await writeFile(stateFilePath(), JSON.stringify(state, null, 2), "utf8")
  } catch {
  }
}

const clearSessionState = async (): Promise<void> => {
  try {
    await rm(stateFilePath(), { force: true })
  } catch {
  }
}

const waitExit = (child: ChildProcess, ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve()
      return
    }
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    child.once("close", finish)
    child.once("error", finish)
  })

const run = (cmd: string, args: string[], opts: RunOptions = {}): Promise<number> =>
  new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(cmd, args, {
        cwd: opts.cwd,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          DOCKER_CLI_HINTS: "false",
          COMPOSE_ANSI: "never"
        },
        windowsHide: true
      })
    } catch (error) {
      pushLog("err", (error as Error).message)
      resolve(-1)
      return
    }

    opts.onSpawn?.(child)

    const errorStream = opts.errorStream ?? "err"
    child.stdout?.on("data", (chunk: Buffer) => pushLog("out", chunk.toString()))
    child.stderr?.on("data", (chunk: Buffer) => pushLog(errorStream, chunk.toString()))

    let settled = false
    const finish = (code: number): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(code)
    }

    const timer = opts.timeoutMs
      ? setTimeout(() => {
        pushLog("err", `${cmd} timed out`)
        try { child.kill("SIGKILL") } catch { }
      }, opts.timeoutMs)
      : null

    child.on("error", (error) => {
      pushLog("err", error.message)
      finish(-1)
    })
    child.on("close", (code) => finish(code ?? -1))
  })


const repoNameFromUrl = (url: string): string => {
  const clean = url.trim().replace(/\.git$/i, "").replace(/[\\/]+$/, "")
  return sanitizeRepoName(basename(clean)) || "lab"
}

const projectNameFor = (repoName: string): string => {
  const clean = repoName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 40)
  return clean ? `cyberlab-${clean}` : "cyberlab"
}

const resolveCompose = async (repoPath: string, repoName: string): Promise<ComposeRef | null> => {
  for (const sub of COMPOSE_DIRS) {
    const dir = sub ? join(repoPath, sub) : repoPath
    for (const file of COMPOSE_FILES) {
      const candidate = join(dir, file)
      try {
        await access(candidate)
        return { file: candidate, projectDir: dir, project: projectNameFor(repoName) }
      } catch {
      }
    }
  }
  return null
}

const composeArgs = (compose: ComposeRef): Array<string> => [
  "compose",
  "-f", compose.file,
  "--project-directory", compose.projectDir,
  "-p", compose.project
]

const killClone = (): void => {
  if (!activeClone) return
  try { activeClone.kill("SIGTERM") } catch { }
  activeClone = null
}

const safeRemoveRepo = async (dir: string): Promise<void> => {
  try {
    await removeRepoDir(dir)
  } catch (error) {
    pushLog("err", `Could not delete ${dir}: ${(error as Error).message}`)
  }
}


const doStartLab = async (opts: LabStartOptions): Promise<LabStatus> => {
  const gen = ++generation
  const url = (opts.url ?? "").trim()

  if (!url) {
    return setStatus({ phase: "idle", error: "Lab repository URL is missing" })
  }

  const repoName = sanitizeRepoName((opts.repoName ?? "").trim() || repoNameFromUrl(url))
  let repoPath = ""
  setLabShellEnv({ COMPOSE_PROJECT_NAME: projectNameFor(repoName) })

  try {
    logBuffer = []
    await ensureRepoRoot()
    repoPath = await repoPathFor(repoName)

    setStatus({ phase: "cloning", repoName, repoPath })
    pushLog("sys", `$ git clone ${url} ${repoPath}`)

    await removeRepoDir(repoPath)
    if (gen !== generation) throw new Error("cancelled")

    const cloneCode = await run(
      "git",
      ["clone", "--depth", "1", url, repoPath],
      {
        cwd: repoRoot(),
        errorStream: "out",
        timeoutMs: 5 * 60 * 1000,
        onSpawn: (child) => { activeClone = child }
      }
    )
    activeClone = null
    if (gen !== generation) throw new Error("cancelled")
    if (cloneCode !== 0) {
      throw new Error("git clone failed. Check the repository URL / network connection.")
    }

    setStatus({ phase: "starting", repoName, repoPath })

    const compose = await resolveCompose(repoPath, repoName)
    if (!compose) {
      throw new Error("No docker compose file (compose.yaml / docker-compose.yml) found in the repository.")
    }
    if (gen !== generation) throw new Error("cancelled")

    await saveSessionState({
      repoName,
      repoPath,
      composeFile: compose.file,
      projectDir: compose.projectDir,
      project: compose.project
    })

    setLabShellEnv({ COMPOSE_PROJECT_NAME: compose.project, COMPOSE_FILE: compose.file })

    const active: ActiveSession = { repoName, repoPath, compose, proc: null }
    session = active

    pushLog("sys", `$ docker ${composeArgs(compose).join(" ")} up`)
    const proc = spawn("docker", [...composeArgs(compose), "up", "--remove-orphans"], {
      cwd: compose.projectDir,
      env: {
        ...process.env,
        DOCKER_CLI_HINTS: "false",
        COMPOSE_ANSI: "never"
      },
      windowsHide: true
    })
    active.proc = proc

    proc.stdout?.on("data", (chunk: Buffer) => pushLog("out", chunk.toString()))
    proc.stderr?.on("data", (chunk: Buffer) => pushLog("out", chunk.toString()))
    proc.on("error", (error) => pushLog("err", error.message))
    proc.on("close", (code, signal) => {
      if (active.proc === proc) active.proc = null
      if (code === 0) pushLog("sys", "docker compose stopped")
      else if (signal) pushLog("sys", `docker compose stopped (${signal})`)
      else pushLog("err", `docker compose exited with code ${code ?? "-"}`)
    })

    pushLog("sys", `Lab is up. Shell is working inside ${repoPath}`)
    return setStatus({ phase: "running", repoName, repoPath })
  } catch (error) {
    if (gen !== generation) {
      if (session) {
        const dead = session
        session = null
        await stopCompose(dead)
        await safeRemoveRepo(dead.repoPath)
        await clearSessionState()
      } else if (repoPath) {
        await safeRemoveRepo(repoPath)
      }
      return currentStatus
    }

    const message = (error as Error).message
    pushLog("err", message)
    if (session) {
      const dead = session
      session = null
      await stopCompose(dead)
      await safeRemoveRepo(dead.repoPath)
      await clearSessionState()
    } else if (repoPath) {
      await safeRemoveRepo(repoPath)
    }
    return setStatus({ phase: "idle", error: message })
  }
}

export const startLab = async (opts: LabStartOptions): Promise<LabStatus> => {
  if (stopPromise) {
    try { await stopPromise } catch { }
  }
  if (startPromise) return currentStatus
  if (session) return { ...currentStatus, error: "A lab is already running" }

  startPromise = doStartLab(opts)
  try {
    return await startPromise
  } finally {
    startPromise = null
  }
}


const stopCompose = async (active: ActiveSession): Promise<void> => {
  const proc = active.proc
  active.proc = null

  if (proc && proc.exitCode === null && proc.signalCode === null) {
    try { proc.kill("SIGKILL") } catch { }
    await waitExit(proc, 2000)
  }

  pushLog("sys", "Stopping lab containers…")
  pushLog("sys", `$ docker ${composeArgs(active.compose).join(" ")} down --remove-orphans -v`)
  const code = await run(
    "docker",
    [...composeArgs(active.compose), "down", "--remove-orphans", "-v", "--timeout", "5"],
    { cwd: active.compose.projectDir, errorStream: "out", timeoutMs: 45000 }
  )
  if (code !== 0) pushLog("err", `docker compose down exited with code ${code}`)
}

const teardownSession = async (): Promise<LabStatus> => {
  const active = session

  if (!active) {
    await clearSessionState()
    return setStatus({ phase: "idle" })
  }

  session = null
  setStatus({ phase: "stopping", repoName: active.repoName, repoPath: active.repoPath })

  killPtySession()
  await stopCompose(active)
  setLabShellEnv({})

  pushLog("sys", `Removing ${active.repoPath}`)
  await safeRemoveRepo(active.repoPath)
  await clearSessionState()

  pushLog("sys", "Lab ended — containers stopped and repository removed.")
  return setStatus({ phase: "idle" })
}

export const stopLab = (): Promise<LabStatus> => {
  if (!stopPromise) {
    stopPromise = (async () => {
      generation += 1
      killClone()

      if (startPromise) {
        try { await startPromise } catch { }
      }
      return teardownSession()
    })().finally(() => {
      stopPromise = null
    })
  }
  return stopPromise
}


export const recoverLabOnBoot = async (): Promise<void> => {
  let saved: SavedSession | null = null
  try {
    saved = JSON.parse(await readFile(stateFilePath(), "utf8")) as SavedSession
  } catch {
    saved = null
  }

  try {
    if (saved?.composeFile && saved.projectDir && saved.project) {
      await run(
        "docker",
        [
          "compose",
          "-f", saved.composeFile,
          "--project-directory", saved.projectDir,
          "-p", saved.project,
          "down", "--remove-orphans", "-v", "--timeout", "5"
        ],
        { cwd: saved.projectDir, errorStream: "out", timeoutMs: 30000 }
      )
    }
  } catch {
  }

  await safeRemoveRepo(repoRoot())
  await clearSessionState()
  logBuffer = []
}


export const registerLabHandlers = (getWindow: () => BrowserWindow | null): void => {
  windowRef = getWindow

  ipcMain.handle("lab:start", (_ev, opts: LabStartOptions) => startLab(opts))
  ipcMain.handle("lab:stop", () => stopLab())
  ipcMain.handle("lab:status", (): LabSnapshot => ({ status: currentStatus, log: logBuffer }))
}
