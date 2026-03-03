import { ipcMain } from 'electron'
import { Recorder } from './recorder'
import { transcribe } from './transcriber'
import { summarize } from './summarizer'
import { getFrontmostApp, typeIntoApp } from './typer'
import { showOverlay, hideOverlay, sendToOverlay } from './overlay-window'
import { loadModes } from './modes'
import { getActiveModeId } from './tray'

const recorder = new Recorder()
let frontmostApp: string | null = null
let isRunning = false

export function startPipeline() {
  if (isRunning) return
  isRunning = true

  // Capture frontmost app BEFORE overlay steals focus
  try { frontmostApp = getFrontmostApp() } catch { frontmostApp = null }

  const win = showOverlay()
  win.webContents.once('did-finish-load', () => {
    sendToOverlay('overlay-state', 'recording')
    recorder.start()
  })

  ipcMain.once('overlay-stop', () => stopRecording())
  ipcMain.once('overlay-cancel', () => cancelPipeline())
}

async function stopRecording() {
  const wavPath = recorder.stop()
  sendToOverlay('overlay-state', 'processing')

  try {
    const rawText = await transcribe(wavPath)
    const modes = loadModes()
    const activeMode = modes.find(m => m.id === getActiveModeId()) ?? modes[0]

    sendToOverlay('overlay-state', 'streaming')

    let fullText = ''
    for await (const token of summarize(rawText, activeMode.prompt)) {
      fullText += token
      sendToOverlay('overlay-state', 'token', token)
    }

    if (frontmostApp) typeIntoApp(fullText, frontmostApp)

  } catch (err) {
    console.error('Pipeline error:', err)
    hideOverlay()
  } finally {
    isRunning = false
  }
}

function cancelPipeline() {
  if (recorder.isRecording) recorder.stop()
  hideOverlay()
  isRunning = false
  ipcMain.removeAllListeners('overlay-stop')
}

ipcMain.on('overlay-close', () => {
  hideOverlay()
})
