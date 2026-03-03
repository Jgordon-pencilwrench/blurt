import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import os from 'os'

export class Recorder {
  private process: ChildProcess | null = null
  private outPath: string | null = null

  start(): string {
    this.outPath = path.join(os.tmpdir(), `blurt-${Date.now()}.wav`)
    this.process = spawn(
      'sox',
      ['-t', 'coreaudio', 'default', '-r', '16000', '-c', '1', '-b', '16', this.outPath],
      { stdio: 'ignore' }
    )
    return this.outPath
  }

  stop(): string {
    if (!this.process || !this.outPath) throw new Error('Not recording')
    this.process.kill('SIGINT')
    this.process = null
    return this.outPath
  }

  get isRecording() { return this.process !== null }
}
