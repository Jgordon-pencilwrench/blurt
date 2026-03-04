import { BrowserWindow, ipcMain, shell, systemPreferences } from 'electron'
import path from 'path'
import { isOllamaRunning, pullModel } from './summarizer'

export async function runSetupIfNeeded(): Promise<void> {
  const ollamaReady = await isOllamaRunning()
  const micGranted = systemPreferences.getMediaAccessStatus('microphone') === 'granted'
  const canType = systemPreferences.isTrustedAccessibilityClient(false)

  if (ollamaReady && micGranted && canType) return

  await showSetupWindow({ ollamaReady, micGranted, canType })
}

function showSetupWindow(status: { ollamaReady: boolean; micGranted: boolean; canType: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 480,
      height: 440,
      title: 'Blurt Setup',
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'setup-preload.js'),
      },
    })

    win.loadFile(path.join(__dirname, '../../src/setup/index.html'))

    ipcMain.handle('setup-status', () => status)
    ipcMain.handle('open-ollama', () => shell.openExternal('https://ollama.com'))
    ipcMain.handle('check-ollama', async () => {
      const ok = await isOllamaRunning()
      status.ollamaReady = ok
      return ok
    })
    ipcMain.handle('pull-model', async () => {
      win.webContents.send('pull-progress', 'Starting download...')
      await pullModel((s) => win.webContents.send('pull-progress', s))
      win.webContents.send('pull-progress', 'done')
    })
    ipcMain.handle('request-mic', async () => {
      await systemPreferences.askForMediaAccess('microphone')
      const granted = systemPreferences.getMediaAccessStatus('microphone') === 'granted'
      status.micGranted = granted
      return granted
    })
    ipcMain.handle('request-accessibility', () => {
      // Prompt = true triggers the system dialog to open Accessibility prefs
      systemPreferences.isTrustedAccessibilityClient(true)
    })
    ipcMain.handle('setup-complete', () => {
      win.close()
      resolve()
    })

    win.on('closed', () => {
      // Remove all handlers to avoid duplicate registration on next launch
      for (const ch of ['setup-status', 'open-ollama', 'check-ollama', 'pull-model', 'request-mic', 'request-accessibility', 'setup-complete']) {
        ipcMain.removeHandler(ch)
      }
      resolve()
    })
  })
}
