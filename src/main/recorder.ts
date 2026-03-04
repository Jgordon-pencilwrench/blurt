import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import os from 'os'

export class Recorder {
  private process: ChildProcess | null = null
  private outPath: string | null = null
  private _isPaused = false

  start(): string {
    this.outPath = path.join(os.tmpdir(), `blurt-${Date.now()}.wav`)
    this.process = spawn(
      'sox',
      ['-t', 'coreaudio', 'default', '-r', '16000', '-c', '1', '-b', '16', this.outPath],
      { stdio: 'ignore' }
    )
    this._isPaused = false
    return this.outPath
  }

  pause(): void {
    if (this.process?.pid && !this._isPaused) {
      process.kill(this.process.pid, 'SIGSTOP')
      this._isPaused = true
    }
  }

  resume(): void {
    if (this.process?.pid && this._isPaused) {
      process.kill(this.process.pid, 'SIGCONT')
      this._isPaused = false
    }
  }

  stop(): string {
    if (!this.process || !this.outPath) throw new Error('Not recording')
    if (this._isPaused) this.resume() // Resume before stopping so sox flushes
    this.process.kill('SIGINT')
    this.process = null
    this._isPaused = false
    return this.outPath
  }

  get isRecording() { return this.process !== null }
  get isPaused() { return this._isPaused }
}
