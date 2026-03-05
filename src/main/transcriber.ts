import { execFile } from 'child_process'
import { readFileSync, unlinkSync, existsSync, mkdirSync, renameSync, createWriteStream } from 'fs'
import path from 'path'
import https from 'https'
import os from 'os'
import { app } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import { log } from './logger'
import { type WhisperModel } from './model-catalog'

const WHISPER_MODELS_DIR = path.join(os.homedir(), '.config', 'blurt', 'whisper-models')

export function getWhisperModelsDir(): string {
  if (!app.isPackaged) {
    return path.join(__dirname, '../../bin')
  }
  return WHISPER_MODELS_DIR
}

export function getWhisperModelPath(model: WhisperModel): string {
  if (model.bundled) {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bin', model.filename)
    }
    return path.join(__dirname, '../../bin', model.filename)
  }
  return path.join(getWhisperModelsDir(), model.filename)
}

export function whisperModelFileExists(model: WhisperModel): boolean {
  return existsSync(getWhisperModelPath(model))
}

export async function downloadWhisperModel(
  model: WhisperModel,
  onProgress: (percent: number, downloadedMB: number, totalMB: number) => void,
): Promise<void> {
  mkdirSync(getWhisperModelsDir(), { recursive: true })
  const dest = getWhisperModelPath(model)
  const tmpDest = dest + '.download'

  return new Promise((resolve, reject) => {
    function doGet(url: string) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doGet(res.headers.location!)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const total = parseInt(res.headers['content-length'] ?? '0', 10) || model.sizeBytes
        let downloaded = 0
        const file = createWriteStream(tmpDest)
        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          onProgress(
            Math.round((downloaded / total) * 100),
            Math.round(downloaded / 1e6),
            Math.round(total / 1e6),
          )
        })
        res.pipe(file)
        file.on('finish', () => {
          file.close(() => {
            renameSync(tmpDest, dest)
            resolve()
          })
        })
        file.on('error', (err: Error) => {
          try { unlinkSync(tmpDest) } catch {}
          reject(err)
        })
      }).on('error', reject)
    }
    doGet(model.url)
  })
}

export function deleteWhisperModel(model: WhisperModel): void {
  if (model.bundled) return
  const p = getWhisperModelPath(model)
  if (existsSync(p)) unlinkSync(p)
}

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
    if (!ffmpegPath) {
      return reject(new Error('ffmpeg binary not found — ffmpeg-static did not bundle a binary for this platform'))
    }

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
    execFile(ffmpegPath, args, { timeout: 30000 }, (err) => {
      if (err) {
        log.error('ffmpeg preprocessing failed', err)
        return reject(err)
      }
      resolve(outputPath)
    })
  })
}

export async function transcribe(wavPath: string): Promise<string> {
  const preprocessedPath = await preprocessAudio(wavPath)

  return new Promise((resolve, reject) => {
    const bin = getWhisperBin()
    const model = getModelPath()
    const args = [
      '-m', model,
      '-f', preprocessedPath,
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

    log.info(`transcribe: ${bin} -m ${model} -f ${preprocessedPath}`)
    execFile(bin, args, { timeout: 60000 }, (err) => {
      if (err) {
        log.error('whisper-cli failed', err)
        try { unlinkSync(preprocessedPath) } catch {}
        try { unlinkSync(wavPath) } catch {}
        return reject(err)
      }
      const txtPath = preprocessedPath + '.txt'
      try {
        const raw = readFileSync(txtPath, 'utf-8')
        unlinkSync(txtPath)
        unlinkSync(preprocessedPath)
        unlinkSync(wavPath)
        resolve(stripHallucinations(raw))
      } catch (e) {
        reject(e)
      }
    })
  })
}
