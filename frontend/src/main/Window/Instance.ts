import { BrowserWindow, dialog } from "electron";

const handleInstance = (win: BrowserWindow) => {
    if (win.isMinimized()) {
        win.restore()
    }
    win.focus()
    dialog.showMessageBox(win, {
        type: 'info',
        title: win.getTitle(),
        message: `An instance of ${win.getTitle()} is already running.\n\tMultiple Instances are not allowed.`,
        buttons: ['OK'],
        defaultId: 0
    })
}

export default handleInstance;