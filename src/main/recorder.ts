import { ipcMain } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { sendToOverlay } from './overlay-window'

export class Recorder {
  private outPath: string | null = null
  private _isRecording = false
  private _isPaused = false

  start(): string {
    this.outPath = path.join(os.tmpdir(), `blurt-${Date.now()}.wav`)
    this._isRecording = true
    this._isPaused = false
    sendToOverlay('recording-command', 'start')
    return this.outPath
  }

  async stop(): Promise<string> {
    if (!this._isRecording || !this.outPath) throw new Error('Not recording')
    if (this._isPaused) this.resume()

    sendToOverlay('recording-command', 'stop')

    const buffer = await waitForRecordingData()
    fs.writeFileSync(this.outPath, Buffer.from(buffer))

    this._isRecording = false
    this._isPaused = false
    return this.outPath
  }

  pause(): void {
    if (this._isRecording && !this._isPaused) {
      sendToOverlay('recording-command', 'pause')
      this._isPaused = true
    }
  }

  resume(): void {
    if (this._isRecording && this._isPaused) {
      sendToOverlay('recording-command', 'resume')
      this._isPaused = false
    }
  }

  cancel(): void {
    if (this._isRecording) {
      sendToOverlay('recording-command', 'stop')
      this._isRecording = false
      this._isPaused = false
      // Discard — don't wait for data
      ipcMain.removeAllListeners('recording-data')
    }
  }

  get isRecording() { return this._isRecording }
  get isPaused() { return this._isPaused }
}

function waitForRecordingData(): Promise<Uint8Array> {
  return new Promise((resolve) => {
    ipcMain.once('recording-data', (_e, buffer: Uint8Array) => {
      resolve(buffer)
    })
  })
}
