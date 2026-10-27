import { spawn } from 'node:child_process'

function runCheck(cmd: string, args: string[], timeoutMs = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (val: boolean): void => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(val)
      }
    }
    const child = spawn(cmd, args, { windowsHide: true })
    const timer = setTimeout(() => {
      child.kill()
      done(false)
    }, timeoutMs)
    child.on('error', () => done(false))
    child.on('close', (code) => done(code === 0))
  })
}

export type CmdType = 'git' | 'docker' | 'compose' | 'dockerDaemon'

export const checkDeps = async (cmd: CmdType):Promise<boolean> => {
  switch (cmd) {
    case 'git':
      return runCheck('git', ['--version'])

    case 'docker':
      return runCheck('docker', ['--version'])

    case 'compose':
      return runCheck('docker', ['compose', 'version'])

    case 'dockerDaemon':
      return runCheck('docker', ['ps'])
  }
}

