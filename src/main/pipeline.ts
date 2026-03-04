import { ipcMain, systemPreferences, clipboard } from 'electron'
import { Recorder } from './recorder'
import { transcribe } from './transcriber'
import { summarize } from './summarizer'
import { getFrontmostApp, typeIntoApp } from './typer'
import { showOverlay, hideOverlay, sendToOverlay, setOverlayHeight } from './overlay-window'
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
  const beginRecording = () => {
    sendToOverlay('overlay-state', 'recording')
    recorder.start()
  }
  // did-finish-load only fires on first load; on subsequent uses the page
  // is already loaded so we send the state immediately
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', beginRecording)
  } else {
    beginRecording()
  }

  ipcMain.once('overlay-stop', onStop)
  ipcMain.once('overlay-cancel', onCancel)
  ipcMain.on('overlay-pause', onPause)
  ipcMain.on('overlay-resume', onResume)
}

function onStop() { stopRecording() }
function onCancel() { cancelPipeline() }
function onPause() {
  if (recorder.isRecording && !recorder.isPaused) {
    recorder.pause()
    sendToOverlay('overlay-state', 'paused')
  }
}
function onResume() {
  if (recorder.isRecording && recorder.isPaused) {
    recorder.resume()
    sendToOverlay('overlay-state', 'recording')
  }
}

async function stopRecording() {
  const wavPath = recorder.stop()

  try {
    sendToOverlay('overlay-state', 'processing', 'Transcribing...')
    const rawText = await transcribe(wavPath)
    const modes = loadModes()
    const activeMode = modes.find(m => m.id === getActiveModeId()) ?? modes[0]

    sendToOverlay('overlay-state', 'processing', 'Summarising...')
    setOverlayHeight(300)
    sendToOverlay('overlay-state', 'streaming')

    let fullText = ''
    for await (const token of summarize(rawText, activeMode.prompt)) {
      fullText += token
      sendToOverlay('overlay-state', 'token', token)
    }

    clipboard.writeText(fullText)
    const canType = systemPreferences.isTrustedAccessibilityClient(false)
    if (frontmostApp && canType) {
      typeIntoApp(fullText, frontmostApp)
      sendToOverlay('overlay-state', 'done', 'Typed ✓')
    } else {
      sendToOverlay('overlay-state', 'done', 'Copied to clipboard ✓ — press ⌘V to paste')
    }

  } catch (err) {
    console.error('Pipeline error:', err)
    hideOverlay()
  } finally {
    isRunning = false
    ipcMain.removeAllListeners('overlay-pause')
    ipcMain.removeAllListeners('overlay-resume')
  }
}

function cancelPipeline() {
  if (recorder.isRecording) recorder.stop()
  hideOverlay()
  isRunning = false
  ipcMain.removeAllListeners('overlay-stop')
  ipcMain.removeAllListeners('overlay-pause')
  ipcMain.removeAllListeners('overlay-resume')
}

ipcMain.on('overlay-close', () => {
  hideOverlay()
})
