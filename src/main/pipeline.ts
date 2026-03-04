import { ipcMain, systemPreferences, clipboard } from 'electron'
import { Recorder } from './recorder'
import { transcribe } from './transcriber'
import { summarize } from './summarizer'
import { getFrontmostApp, typeIntoApp } from './typer'
import { showOverlay, hideOverlay, sendToOverlay, setOverlayHeight } from './overlay-window'
import { loadModes } from './modes'
import { getActiveModeId } from './tray'
import { log } from './logger'

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
  const wavPath = await recorder.stop()

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
      sendToOverlay('overlay-state', 'done', 'Typed \u2713')
    } else {
      sendToOverlay('overlay-state', 'done', 'Copied to clipboard \u2713 \u2014 press \u2318V to paste')
    }
    log.info(`Pipeline complete — ${canType && frontmostApp ? 'typed into ' + frontmostApp : 'copied to clipboard'}`)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('Pipeline error', err instanceof Error ? err : new Error(message))
    sendToOverlay('overlay-state', 'error', message)
    const errorTimer = setTimeout(() => hideOverlay(), 4000)
    ipcMain.once('overlay-close', () => {
      clearTimeout(errorTimer)
      hideOverlay()
    })
  } finally {
    isRunning = false
    ipcMain.removeAllListeners('overlay-pause')
    ipcMain.removeAllListeners('overlay-resume')
  }
}

function cancelPipeline() {
  if (recorder.isRecording) recorder.cancel()
  hideOverlay()
  isRunning = false
  ipcMain.removeAllListeners('overlay-stop')
  ipcMain.removeAllListeners('overlay-pause')
  ipcMain.removeAllListeners('overlay-resume')
}

ipcMain.on('overlay-close', () => {
  hideOverlay()
})
