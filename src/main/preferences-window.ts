import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { loadModes, saveModes, Mode } from './modes'

let prefsWin: BrowserWindow | null = null

export function openPreferences() {
  if (prefsWin && !prefsWin.isDestroyed()) {
    prefsWin.focus()
    return
  }

  prefsWin = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'Blurt Preferences',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'prefs-preload.js'),
    },
  })

  prefsWin.loadFile(path.join(__dirname, '../../src/preferences/index.html'))
}

ipcMain.handle('get-modes', () => loadModes())
ipcMain.handle('save-modes', (_e, modes: Mode[]) => saveModes(modes))
