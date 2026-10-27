import type { BrowserWindow } from "electron";

function minimize(win: null | BrowserWindow): void {
    if (!win) return
    win.minimize()
}

function maximize(win: null | BrowserWindow): void {
    if (!win) return
    if (win.isMaximized()) {
        win.restore()
    } else {
        win.maximize()
    }
}

function close(win: null | BrowserWindow): void {
    if (!win) return
    win.close()
}

export { minimize, maximize, close }
