import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { loadModes, saveModes, Mode } from './modes'
import { loadSettings, saveSettings } from './settings'
import { updateHotkey } from './hotkey'
import { rebuildTrayMenu } from './tray'

let prefsWin: BrowserWindow | null = null

export function openPreferences() {
  if (prefsWin && !prefsWin.isDestroyed()) {
    prefsWin.focus()
    return
  }

  prefsWin = new BrowserWindow({
    width: 680,
    height: 460,
    minWidth: 580,
    minHeight: 380,
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
ipcMain.handle('save-modes', (_e, modes: Mode[]) => {
  saveModes(modes)
  rebuildTrayMenu()
})

ipcMain.handle('get-settings', () => loadSettings())
ipcMain.handle('save-settings', (_e, settings: { hotkey: string }) => {
  const ok = updateHotkey(settings.hotkey)
  if (!ok) return { ok: false, error: 'Shortcut is already in use by another app' }
  saveSettings(settings)
  return { ok: true }
})
