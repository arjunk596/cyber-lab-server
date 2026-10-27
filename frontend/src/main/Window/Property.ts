import { app, BrowserWindowConstructorOptions } from "electron";
import { join } from "node:path";

const icon = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')

const windowProperty: BrowserWindowConstructorOptions = {
    height: 900,
    width: 1220,
    minHeight: 600,
    minWidth: 800,
    show: false,
    frame: false,
    transparent: true,
    title: 'CRCE Cyber Lab',
    icon,
    webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
    }
}

export default windowProperty
