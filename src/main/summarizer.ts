import { spawn } from 'child_process'
import { app } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import https from 'https'
import { loadSettings } from './settings'
import { getModelById, getDefaultModel, type ModelOption, type ChatTemplate } from './model-catalog'
import { log } from './logger'

const MODELS_DIR = path.join(os.homedir(), '.config', 'blurt', 'models')

function getLlamaBinaryPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'llama-completion')
  }
  return path.join(__dirname, '../../bin/llama-completion')
}

function getModelsDir(): string {
  // In dev, models live alongside binaries in bin/ (placed by download-assets.ts)
  if (!app.isPackaged) {
    return path.join(__dirname, '../../bin')
  }
  return MODELS_DIR
}

function getModelPath(model: ModelOption): string {
  return path.join(getModelsDir(), model.filename)
}

export function getActiveModelOption(): ModelOption {
  const settings = loadSettings()
  return getModelById(settings.activeModel) ?? getDefaultModel()
}

export function isModelAvailable(model?: ModelOption): boolean {
  const m = model ?? getActiveModelOption()
  return fs.existsSync(getModelPath(m))
}

export function modelFileExists(model: ModelOption): boolean {
  return fs.existsSync(getModelPath(model))
}

export async function downloadModel(
  model: ModelOption,
  onProgress: (percent: number, downloadedMB: number, totalMB: number) => void,
): Promise<void> {
  fs.mkdirSync(getModelsDir(), { recursive: true })
  const dest = getModelPath(model)
  const tmpDest = dest + '.download'

  return new Promise((resolve, reject) => {
    function doGet(url: string) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doGet(res.headers.location!)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`))
          return
        }

        const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10) || model.sizeBytes
        let downloaded = 0

        const file = fs.createWriteStream(tmpDest)
        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          const percent = Math.round((downloaded / totalBytes) * 100)
          onProgress(percent, downloaded / 1e6, totalBytes / 1e6)
        })
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          fs.renameSync(tmpDest, dest)
          resolve()
        })
        file.on('error', (err) => {
          try { fs.unlinkSync(tmpDest) } catch {} // best effort cleanup
          reject(err)
        })
      }).on('error', reject)
    }
    doGet(model.url)
  })
}

export function deleteModel(model: ModelOption): void {
  const p = getModelPath(model)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

function formatPrompt(template: ChatTemplate, systemPrompt: string, userText: string): string {
  switch (template) {
    case 'chatml':
      return `<|im_start|>system\n/no_think\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`
    case 'llama3':
      return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userText}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
  }
}

export async function* summarize(rawText: string, systemPrompt: string, temperature = 0.7): AsyncGenerator<string> {
  const model = getActiveModelOption()
  const modelPath = getModelPath(model)

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model not found: ${modelPath}`)
  }

  const prompt = formatPrompt(model.chatTemplate, systemPrompt, rawText)

  log.info(`summarize: ${getLlamaBinaryPath()} -m ${modelPath}`)
  const child = spawn(getLlamaBinaryPath(), [
    '-m', modelPath,
    '-p', prompt,
    '-no-cnv',
    '--no-display-prompt',
    '-n', '512',
    '--temp', String(temperature),
    '-ngl', '99',
  ])

  const { promise, resolve, reject } = promiseWithResolvers<void>()
  let errOutput = ''

  child.stderr?.on('data', (chunk: Buffer) => {
    errOutput += chunk.toString()
  })

  child.on('error', (err) => {
    log.error('llama-completion spawn error', err)
    reject(err)
  })
  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      const msg = `llama-completion exited with code ${code}: ${errOutput.slice(-500)}`
      log.error(msg)
      reject(new Error(msg))
    } else {
      resolve()
    }
  })

  const stdout = child.stdout!
  const decoder = new TextDecoder()

  for await (const chunk of stdout) {
    const text = decoder.decode(chunk as Buffer, { stream: true })
    if (text) yield text
  }

  await promise
}

function promiseWithResolvers<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
