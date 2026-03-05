import { execFile } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import path from 'path'
import { app } from 'electron'
import ffmpegPath from 'ffmpeg-static'
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

const HALLUCINATION_PATTERNS = [
  /^(Thanks for watching|Thank you for watching)[.!]?$/i,
  /^Subtitles by .+$/i,
  /^(Subscribe|Like and subscribe)[.!]?$/i,
  /^\[Music\]$/i,
  /^\[Applause\]$/i,
  /^(www\.|http:\/\/)/i,
]

export function stripHallucinations(transcript: string): string {
  return transcript
    .split('\n')
    .filter(line => !HALLUCINATION_PATTERNS.some(r => r.test(line.trim())))
    .join('\n')
    .trim()
}

export function preprocessAudio(wavPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = wavPath.replace(/\.wav$/, '-preprocessed.wav')
    const filterChain = [
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      'silenceremove=start_periods=1:start_silence=0.3:start_threshold=-50dB:stop_periods=-1:stop_duration=0.3:stop_threshold=-50dB',
    ].join(',')

    const args = [
      '-i', wavPath,
      '-af', filterChain,
      '-ar', '16000',
      '-ac', '1',
      '-y',
      outputPath,
    ]

    log.info(`preprocessAudio: ffmpeg ${args.join(' ')}`)
    execFile(ffmpegPath as string, args, { timeout: 30000 }, (err) => {
      if (err) {
        log.error('ffmpeg preprocessing failed', err)
        return reject(err)
      }
      resolve(outputPath)
    })
  })
}

export function transcribe(wavPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = getWhisperBin()
    const model = getModelPath()
    const args = [
      '-m', model,
      '-f', wavPath,
      '--output-txt',
      '--no-timestamps',
      '-np',
      '--no-speech-thr', '0.6',
      '--logprob-thr', '-1.0',
      '--compression-ratio-thr', '2.4',
      '--temperature', '0',
      '--temperature-inc', '0.2',
      '--beam-size', '3',
      '--language', 'en',
    ]

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
