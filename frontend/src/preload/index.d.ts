import type { CmdType } from '../main/Process/checkDependency'
import type { LabLog, LabSnapshot, LabStartOptions, LabStatus } from '../shared/lab'
/// <reference types="vite/client" />
export { };
declare global {
  interface Window {
    api: {
      winCtrl: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      process: {
        checkDependency: (cmd: CmdType) => Promise<boolean>
      }
      pty: {
        spawn: (cols: number, rows: number, cwd?: string) => Promise<boolean>
        write: (data: string) => void
        resize: (cols: number, rows: number) => void
        kill: () => void
        onData: (cb: (data: string) => void) => () => void
        onExit: (cb: () => void) => () => void
      }
      lab: {
        start: (opts: LabStartOptions) => Promise<LabStatus>
        stop: () => Promise<LabStatus>
        status: () => Promise<LabSnapshot>
        onLog: (cb: (entry: LabLog) => void) => () => void
        onStatus: (cb: (status: LabStatus) => void) => () => void
      }
      openURL: (url: string) => Promise<void>
    }
  }
}
