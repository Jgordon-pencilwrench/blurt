import { BrowserWindow, ipcMain, systemPreferences } from 'electron'
import path from 'path'
import { getActiveModelOption, isModelAvailable, downloadModel, modelFileExists } from './summarizer'
import { MODEL_CATALOG } from './model-catalog'
import { loadSettings, saveSettings } from './settings'

export async function runSetupIfNeeded(): Promise<void> {
  const activeModel = getActiveModelOption()
  const modelReady = isModelAvailable(activeModel)
  const micGranted = systemPreferences.getMediaAccessStatus('microphone') === 'granted'

  if (modelReady && micGranted) return

  await showSetupWindow()
}

function showSetupWindow(): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 560,
      height: 520,
      title: 'Blurt Setup',
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'setup-preload.js'),
      },
    })

    win.loadFile(path.join(__dirname, '../../src/setup/index.html'))

    let accessibilityPollTimer: ReturnType<typeof setInterval> | null = null

    ipcMain.handle('setup-status', () => {
      const settings = loadSettings()
      const activeModel = getActiveModelOption()
      return {
        modelReady: modelFileExists(activeModel),
        micGranted: systemPreferences.getMediaAccessStatus('microphone') === 'granted',
        canType: systemPreferences.isTrustedAccessibilityClient(false),
        catalog: MODEL_CATALOG,
        activeModelId: settings.activeModel,
      }
    })

    ipcMain.handle('select-and-download-model', async (_e, modelId: string) => {
      const model = MODEL_CATALOG.find((m) => m.id === modelId)
      if (!model) throw new Error(`Unknown model: ${modelId}`)

      // Save selection to settings
      const settings = loadSettings()
      settings.activeModel = modelId
      saveSettings(settings)

      // Download if not already present
      if (!modelFileExists(model)) {
        await downloadModel(model, (percent, downloadedMB, totalMB) => {
          win.webContents.send('download-progress', { modelId, percent, downloadedMB, totalMB })
        })
      }

      return true
    })

    ipcMain.handle('request-mic', async () => {
      await systemPreferences.askForMediaAccess('microphone')
      return systemPreferences.getMediaAccessStatus('microphone') === 'granted'
    })

    ipcMain.handle('request-accessibility', () => {
      systemPreferences.isTrustedAccessibilityClient(true)
      // Start polling for accessibility grant
      if (!accessibilityPollTimer) {
        accessibilityPollTimer = setInterval(() => {
          const granted = systemPreferences.isTrustedAccessibilityClient(false)
          if (granted) {
            win.webContents.send('accessibility-granted')
            if (accessibilityPollTimer) {
              clearInterval(accessibilityPollTimer)
              accessibilityPollTimer = null
            }
          }
        }, 3000)
      }
    })

    ipcMain.handle('setup-complete', () => {
      win.close()
      resolve()
    })

    win.on('closed', () => {
      if (accessibilityPollTimer) {
        clearInterval(accessibilityPollTimer)
        accessibilityPollTimer = null
      }
      for (const ch of ['setup-status', 'select-and-download-model', 'request-mic', 'request-accessibility', 'setup-complete']) {
        ipcMain.removeHandler(ch)
      }
      resolve()
    })
  })
}
