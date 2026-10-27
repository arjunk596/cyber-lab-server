import { contextBridge, ipcRenderer } from "electron";
import type { CmdType } from "../main/Process/checkDependency";
import type { LabLog, LabSnapshot, LabStartOptions, LabStatus } from "../shared/lab";

const api = {
    winCtrl: {
        minimize: () => { ipcRenderer.send('win:minimize') },
        maximize: () => { ipcRenderer.send('win:maximize') },
        close: () => { ipcRenderer.send('win:close') }
    },
    process: {
        checkDependency: (cmd: CmdType) => ipcRenderer.invoke('proc:checkDependency', cmd)
    },
    pty: {
        spawn: (cols: number, rows: number, cwd?: string) =>
            ipcRenderer.invoke('pty:spawn', { cols, rows, cwd }),
        write: (data: string) => ipcRenderer.send('pty:stdin', data),
        resize: (cols: number, rows: number) => ipcRenderer.send('pty:resize', { cols, rows }),
        kill: () => ipcRenderer.send('pty:kill'),
        onData: (cb: (data: string) => void) => {
            const listener = (_: unknown, data: string) => cb(data)
            ipcRenderer.on('pty:data', listener)
            return () => { ipcRenderer.off('pty:data', listener) }
        },
        onExit: (cb: () => void) => {
            const listener = () => cb()
            ipcRenderer.on('pty:exit', listener)
            return () => { ipcRenderer.off('pty:exit', listener) }
        }
    },
    lab: {
        start: (opts: LabStartOptions): Promise<LabStatus> => ipcRenderer.invoke('lab:start', opts),
        stop: (): Promise<LabStatus> => ipcRenderer.invoke('lab:stop'),
        status: (): Promise<LabSnapshot> => ipcRenderer.invoke('lab:status'),
        onLog: (cb: (entry: LabLog) => void) => {
            const listener = (_: unknown, entry: LabLog) => cb(entry)
            ipcRenderer.on('lab:log', listener)
            return () => { ipcRenderer.off('lab:log', listener) }
        },
        onStatus: (cb: (status: LabStatus) => void) => {
            const listener = (_: unknown, status: LabStatus) => cb(status)
            ipcRenderer.on('lab:status', listener)
            return () => { ipcRenderer.off('lab:status', listener) }
        }
    },
    openURL: (url: string) => ipcRenderer.invoke('open-external-url', url)
}

contextBridge.exposeInMainWorld('api', api)
