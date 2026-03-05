import { spawn } from 'child_process'
import { app } from 'electron'
import path from 'path'
import os from 'os'
import fs from 'fs'
import https from 'https'
import { loadSettings } from './settings'
import { getModelById, getDefaultModel, type ModelOption, type ChatTemplate } from './model-catalog'
import { log } from './logger'
import type { Mode } from './modes'

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

function buildSystemPrompt(): string {
  return [
    'You are a text reformatting function.',
    'You will be provided with instructions on how to reformat, respond to, or modify the user_message provided.',
    'Respond with the result of following the instructions and nothing else.',
  ].join('\n')
}

function buildUserMessage(
  modePrompt: string,
  transcript: string,
  examples: Array<{ input: string; output: string }> = [],
  language = 'English',
): string {
  const now = new Date()
  const timeStr = now.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en_US'

  const parts: string[] = [
    `INSTRUCTIONS:\n${modePrompt}`,
    '',
    `The user is speaking ${language}, reformatted message should also be in ${language}.`,
  ]

  if (examples.length > 0) {
    parts.push('')
    parts.push('EXAMPLES OF CORRECT BEHAVIOR:')
    for (const ex of examples) {
      parts.push(`User: ${ex.input}`)
      parts.push(`Assistant: ${ex.output}`)
    }
  }

  parts.push(
    '',
    'SYSTEM CONTEXT:',
    `Current time: ${timeStr}`,
    `Time zone: ${timezone}`,
    `Locale: ${locale}`,
    '',
    'USER MESSAGE:',
    transcript,
  )

  return parts.join('\n')
}

function formatPrompt(template: ChatTemplate, mode: Mode, transcript: string): string {
  const system = buildSystemPrompt()
  const user = buildUserMessage(mode.prompt, transcript, mode.examples ?? [])

  switch (template) {
    case 'chatml':
      return `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`
    case 'llama3':
      return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${user}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
  }
}

export async function* summarize(rawText: string, mode: Mode): AsyncGenerator<string> {
  const model = getActiveModelOption()
  const modelPath = getModelPath(model)

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model not found: ${modelPath}`)
  }

  const prompt = formatPrompt(model.chatTemplate, mode, rawText)

  log.info(`summarize: ${getLlamaBinaryPath()} -m ${modelPath}`)
  const child = spawn(getLlamaBinaryPath(), [
    '-m', modelPath,
    '-p', prompt,
    '-no-cnv',
    '--no-display-prompt',
    '-n', '512',
    '--temp', String(mode.temperature ?? 0.7),
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
