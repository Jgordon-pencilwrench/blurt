import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { loadModes, saveModes, Mode } from './modes'
import { loadSettings, saveSettings } from './settings'
import { updateHotkey } from './hotkey'
import { rebuildTrayMenu } from './tray'
import { MODEL_CATALOG, WHISPER_CATALOG } from './model-catalog'
import { modelFileExists, downloadModel, deleteModel } from './summarizer'
import { whisperModelFileExists, downloadWhisperModel, deleteWhisperModel } from './transcriber'

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
ipcMain.handle('save-settings', (_e, partial: { hotkey: string }) => {
  const ok = updateHotkey(partial.hotkey)
  if (!ok) return { ok: false, error: 'Shortcut is already in use by another app' }
  const current = loadSettings()
  saveSettings({ ...current, hotkey: partial.hotkey })
  return { ok: true }
})

ipcMain.handle('get-model-status', () => {
  const settings = loadSettings()
  return {
    catalog: MODEL_CATALOG.map((m) => ({
      ...m,
      downloaded: modelFileExists(m),
      active: m.id === settings.activeModel,
    })),
    activeModelId: settings.activeModel,
  }
})

ipcMain.handle('download-model', async (_e, modelId: string) => {
  const model = MODEL_CATALOG.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model: ${modelId}`)
  if (modelFileExists(model)) return true

  await downloadModel(model, (percent, downloadedMB, totalMB) => {
    prefsWin?.webContents.send('model-download-progress', { modelId, percent, downloadedMB, totalMB })
  })
  return true
})

ipcMain.handle('set-active-model', (_e, modelId: string) => {
  const settings = loadSettings()
  settings.activeModel = modelId
  saveSettings(settings)
  return true
})

ipcMain.handle('delete-model', (_e, modelId: string) => {
  const model = MODEL_CATALOG.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model: ${modelId}`)
  deleteModel(model)
  return true
})

ipcMain.handle('get-whisper-model-status', () => {
  return WHISPER_CATALOG.map((m) => ({
    ...m,
    downloaded: m.bundled || whisperModelFileExists(m),
  }))
})

ipcMain.handle('download-whisper-model', async (_e, modelId: string) => {
  const model = WHISPER_CATALOG.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown whisper model: ${modelId}`)
  if (whisperModelFileExists(model)) return true

  await downloadWhisperModel(model, (percent, downloadedMB, totalMB) => {
    prefsWin?.webContents.send('whisper-download-progress', { modelId, percent, downloadedMB, totalMB })
  })
  return true
})

ipcMain.handle('delete-whisper-model', (_e, modelId: string) => {
  const model = WHISPER_CATALOG.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown whisper model: ${modelId}`)
  deleteWhisperModel(model)
  return true
})
