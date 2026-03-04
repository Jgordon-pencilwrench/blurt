import { execFile } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import path from 'path'
import { app } from 'electron'
import { log } from './logger'

function getWhisperBin(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'whisper-cli')
  }
  return path.join(__dirname, '../../bin/whisper-cli')
}

function getModelPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'ggml-base.en.bin')
  }
  return path.join(__dirname, '../../bin/ggml-base.en.bin')
}

export function transcribe(wavPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = getWhisperBin()
    const model = getModelPath()
    const args = ['-m', model, '-f', wavPath, '--output-txt', '--no-timestamps', '-np']

    log.info(`transcribe: ${bin} -m ${model} -f ${wavPath}`)
    execFile(bin, args, { timeout: 30000 }, (err) => {
      if (err) {
        log.error('whisper-cli failed', err)
        return reject(err)
      }
      const txtPath = wavPath + '.txt'
      try {
        const text = readFileSync(txtPath, 'utf-8').trim()
        unlinkSync(txtPath)
        unlinkSync(wavPath)
        resolve(text)
      } catch (e) {
        reject(e)
      }
    })
  })
}
