# Blurt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a macOS menubar app that captures voice via global hotkey, transcribes offline with Whisper, summarizes with a local LLM (Ollama), streams output in a floating overlay, then auto-types the result at the cursor.

**Architecture:** Electron app (TypeScript) with no Dock presence — lives in the menubar tray. A frameless, always-on-top overlay window handles recording UI, waveform visualization, and streaming output. Core pipeline: sox audio capture → whisper.cpp CLI transcription → Ollama streaming summarization → osascript auto-type + clipboard write.

**Tech Stack:** Electron 34, TypeScript, electron-builder (DMG), sox (brew), whisper.cpp CLI (compiled by download-assets script with Metal support), Ollama REST API (`localhost:11434`), osascript (auto-type + frontmost app), Vitest (unit tests)

---

## Prerequisites (document in README)

The user must have:
- Xcode Command Line Tools: `xcode-select --install`
- Homebrew: `brew install cmake sox`
- Ollama: https://ollama.com (install manually)
- Node.js 20+ and yarn

---

## Task 1: Repo Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `electron-builder.yml`
- Create: `.gitignore`
- Create: `src/main/index.ts` (empty entry)

**Step 1: Create the repo**

```bash
mkdir blurt && cd blurt
git init
mkdir -p src/main src/overlay src/preferences scripts bin assets
```

**Step 2: Write `package.json`**

```json
{
  "name": "blurt",
  "version": "0.1.0",
  "description": "Offline voice-to-text macOS menubar app",
  "main": "dist/main/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "yarn build && electron .",
    "download-assets": "ts-node scripts/download-assets.ts",
    "dist": "yarn build && electron-builder",
    "test": "vitest run"
  },
  "devDependencies": {
    "electron": "^34.0.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.4.0",
    "ts-node": "^10.9.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Write `electron-builder.yml`**

```yaml
appId: com.blurt.app
productName: Blurt
directories:
  output: dist-app
files:
  - dist/**/*
  - bin/**/*
  - src/overlay/**/*
  - src/preferences/**/*
  - assets/**/*
extraResources:
  - from: bin/
    to: bin/
    filter:
      - "whisper-cli"
      - "ggml-base.en.bin"
mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch: arm64
dmg:
  title: Blurt
```

**Step 5: Write `.gitignore`**

```
node_modules/
dist/
dist-app/
bin/whisper-cli
bin/ggml-base.en.bin
*.wav
*.txt
```

**Step 6: Create empty entry point**

`src/main/index.ts`:
```typescript
// Entry point — filled in Task 3
```

**Step 7: Install dependencies and commit**

```bash
yarn install
git add -A
git commit -m "chore: repo scaffold"
```

---

## Task 2: Download-Assets Script

**Files:**
- Create: `scripts/download-assets.ts`

This script compiles whisper.cpp with Metal support and downloads the base.en model. Run once before `yarn dist`.

**Step 1: Write the script**

`scripts/download-assets.ts`:
```typescript
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import https from 'https'
import fs from 'fs'

const ROOT = join(__dirname, '..')
const BIN_DIR = join(ROOT, 'bin')
const WHISPER_BINARY = join(BIN_DIR, 'whisper-cli')
const WHISPER_MODEL = join(BIN_DIR, 'ggml-base.en.bin')
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'
const WHISPER_REPO = 'https://github.com/ggerganov/whisper.cpp.git'
const TMP_DIR = '/tmp/whisper-cpp-build'

if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR)

function run(cmd: string, cwd?: string) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd })
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`)
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close()
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', reject)
  })
}

async function main() {
  if (!existsSync(WHISPER_BINARY)) {
    console.log('Building whisper.cpp...')
    if (!existsSync(TMP_DIR)) {
      run(`git clone --depth 1 ${WHISPER_REPO} ${TMP_DIR}`)
    }
    run('cmake -B build -DGGML_METAL=ON', TMP_DIR)
    run('cmake --build build --config Release -j4', TMP_DIR)
    run(`cp ${TMP_DIR}/build/bin/whisper-cli ${WHISPER_BINARY}`)
    console.log('whisper-cli built successfully.')
  } else {
    console.log('whisper-cli already exists, skipping build.')
  }

  if (!existsSync(WHISPER_MODEL)) {
    await downloadFile(MODEL_URL, WHISPER_MODEL)
    console.log('Model downloaded.')
  } else {
    console.log('Model already exists, skipping download.')
  }

  console.log('Assets ready.')
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Step 2: Test it**

```bash
yarn download-assets
```

Expected: whisper.cpp compiles (takes ~2 min), `bin/whisper-cli` and `bin/ggml-base.en.bin` appear.

**Step 3: Commit**

```bash
git add scripts/download-assets.ts
git commit -m "chore: add download-assets script (compiles whisper.cpp with Metal)"
```

---

## Task 3: Electron App Entry + Lifecycle

**Files:**
- Modify: `src/main/index.ts`

**Step 1: Write the main entry**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron'

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Hide from Dock — menubar only
app.dock?.hide()

app.whenReady().then(async () => {
  // Tray, hotkey, setup wizard wired in later tasks
  console.log('Blurt ready')
})

app.on('window-all-closed', () => {
  // Don't quit when all windows close — we live in the tray
})
```

**Step 2: Verify it launches**

```bash
yarn dev
```

Expected: no crash, no Dock icon, console prints "Blurt ready".

**Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: electron app entry with single instance lock and no dock"
```

---

## Task 4: Modes System

**Files:**
- Create: `src/main/modes.ts`
- Create: `src/main/modes.test.ts`

**Step 1: Write failing tests**

`src/main/modes.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'

vi.mock('fs')

const MOCK_MODES = [
  { id: 'quick-note', name: 'Quick Note', prompt: 'Compress to gist, bullet points as appropriate. Remove filler words.', hotkey: null },
  { id: 'message', name: 'Message', prompt: 'Clean up into conversational prose. Remove filler words. No bullet points.', hotkey: null },
  { id: 'agent', name: 'Agent', prompt: 'Terse and direct. Technical. Remove all filler. Optimised for pasting into an AI agent.', hotkey: null },
  { id: 'dev-note', name: 'Dev Note', prompt: 'Technical note. Preserve code identifiers and variable names exactly. Bullet points for steps.', hotkey: null },
]

describe('modes', () => {
  it('returns default modes when config file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const { loadModes } = await import('./modes')
    const modes = loadModes()
    expect(modes).toHaveLength(4)
    expect(modes[0].id).toBe('quick-note')
  })

  it('loads modes from config file when it exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(MOCK_MODES))
    const { loadModes } = await import('./modes')
    const modes = loadModes()
    expect(modes).toHaveLength(4)
  })

  it('saves modes to config file', async () => {
    const writeSpy = vi.mocked(fs.writeFileSync)
    const { saveModes } = await import('./modes')
    saveModes(MOCK_MODES)
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('modes.json'),
      JSON.stringify(MOCK_MODES, null, 2)
    )
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
yarn test src/main/modes.test.ts
```

Expected: FAIL — `modes` module not found.

**Step 3: Write implementation**

`src/main/modes.ts`:
```typescript
import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Mode {
  id: string
  name: string
  prompt: string
  hotkey: string | null
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'blurt')
const CONFIG_FILE = path.join(CONFIG_DIR, 'modes.json')

const DEFAULT_MODES: Mode[] = [
  {
    id: 'quick-note',
    name: 'Quick Note',
    prompt: 'Compress to gist. Bullet points as appropriate. Remove filler words. Be concise.',
    hotkey: null,
  },
  {
    id: 'message',
    name: 'Message',
    prompt: 'Clean up into conversational prose. Remove filler words. No bullet points.',
    hotkey: null,
  },
  {
    id: 'agent',
    name: 'Agent',
    prompt: 'Terse and direct. Technical. Remove all filler. Optimised for pasting into an AI agent or Claude Code.',
    hotkey: null,
  },
  {
    id: 'dev-note',
    name: 'Dev Note',
    prompt: 'Technical note. Preserve code identifiers and variable names exactly. Bullet points for steps.',
    hotkey: null,
  },
]

export function loadModes(): Mode[] {
  if (!fs.existsSync(CONFIG_FILE)) return DEFAULT_MODES
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return DEFAULT_MODES
  }
}

export function saveModes(modes: Mode[]): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(modes, null, 2))
}
```

**Step 4: Run tests to verify they pass**

```bash
yarn test src/main/modes.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/modes.ts src/main/modes.test.ts
git commit -m "feat: modes system with defaults and config file persistence"
```

---

## Task 5: Tray Setup

**Files:**
- Create: `src/main/tray.ts`
- Create: `assets/tray-icon.png` (16x16 and 32x32 — use a simple mic icon PNG, or placeholder)
- Modify: `src/main/index.ts`

**Step 1: Write `src/main/tray.ts`**

```typescript
import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'
import { loadModes, Mode } from './modes'

let tray: Tray | null = null
let activeModeId = 'quick-note'

export function getActiveModeId() { return activeModeId }

export function setupTray(onModeChange: (mode: Mode) => void, onPreferences: () => void) {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Blurt')
  rebuildMenu(onModeChange, onPreferences)
}

function rebuildMenu(onModeChange: (mode: Mode) => void, onPreferences: () => void) {
  const modes = loadModes()
  const modeItems = modes.map((mode) => ({
    label: mode.name,
    type: 'radio' as const,
    checked: mode.id === activeModeId,
    click: () => {
      activeModeId = mode.id
      onModeChange(mode)
      tray?.setToolTip(`Blurt — ${mode.name}`)
      rebuildMenu(onModeChange, onPreferences)
    },
  }))

  const menu = Menu.buildFromTemplate([
    ...modeItems,
    { type: 'separator' },
    { label: 'Preferences...', click: onPreferences },
    { type: 'separator' },
    { label: 'Quit Blurt', click: () => app.quit() },
  ])
  tray?.setContextMenu(menu)
}
```

**Step 2: Create a placeholder tray icon**

Create `assets/tray-icon.png` — a 32x32 PNG (any solid-color square will work for now; replace later with a real mic icon). You can use any image editor or download a free mic icon. Name it `tray-icon.png`.

**Step 3: Wire tray into `src/main/index.ts`**

```typescript
import { app } from 'electron'
import { setupTray } from './tray'
import { loadModes } from './modes'

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
app.dock?.hide()

app.whenReady().then(async () => {
  const modes = loadModes()
  setupTray(
    (mode) => console.log('Mode changed to:', mode.name),
    () => console.log('Open preferences')
  )
})

app.on('window-all-closed', () => {})
```

**Step 4: Test manually**

```bash
yarn dev
```

Expected: menubar icon appears, right-click shows mode list with radio buttons, Quit works.

**Step 5: Commit**

```bash
git add src/main/tray.ts assets/tray-icon.png src/main/index.ts
git commit -m "feat: menubar tray with mode switching"
```

---

## Task 6: Audio Recorder

**Files:**
- Create: `src/main/recorder.ts`
- Create: `src/main/recorder.test.ts`

**Step 1: Write failing tests**

`src/main/recorder.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChildProcess } from 'child_process'

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))

describe('Recorder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('spawns sox with correct args when recording starts', async () => {
    const mockProcess = { kill: vi.fn(), on: vi.fn() } as unknown as ChildProcess
    mockSpawn.mockReturnValue(mockProcess)

    const { Recorder } = await import('./recorder')
    const recorder = new Recorder()
    const outPath = recorder.start()

    expect(mockSpawn).toHaveBeenCalledWith(
      'sox',
      expect.arrayContaining(['-t', 'coreaudio', 'default', expect.stringContaining('.wav')]),
      expect.any(Object)
    )
    expect(outPath).toMatch(/\.wav$/)
  })

  it('kills the sox process when stop is called', async () => {
    const mockProcess = { kill: vi.fn(), on: vi.fn() } as unknown as ChildProcess
    mockSpawn.mockReturnValue(mockProcess)

    const { Recorder } = await import('./recorder')
    const recorder = new Recorder()
    recorder.start()
    recorder.stop()

    expect(mockProcess.kill).toHaveBeenCalled()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
yarn test src/main/recorder.test.ts
```

Expected: FAIL.

**Step 3: Write implementation**

`src/main/recorder.ts`:
```typescript
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
```

**Step 4: Run tests to verify they pass**

```bash
yarn test src/main/recorder.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/recorder.ts src/main/recorder.test.ts
git commit -m "feat: sox-based audio recorder"
```

---

## Task 7: Transcriber

**Files:**
- Create: `src/main/transcriber.ts`
- Create: `src/main/transcriber.test.ts`

**Step 1: Write failing tests**

`src/main/transcriber.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

const mockExecFile = vi.fn()
vi.mock('child_process', () => ({ execFile: mockExecFile }))

describe('Transcriber', () => {
  it('calls whisper-cli with correct args and returns trimmed text', async () => {
    mockExecFile.mockImplementation((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, '', '')
    })

    // whisper-cli writes output to a .txt file alongside the wav
    const mockReadFileSync = vi.fn().mockReturnValue('Hello world  \n')
    vi.mock('fs', () => ({ readFileSync: mockReadFileSync, unlinkSync: vi.fn(), existsSync: vi.fn().mockReturnValue(true) }))

    const { transcribe } = await import('./transcriber')
    const result = await transcribe('/tmp/test.wav')

    expect(mockExecFile).toHaveBeenCalledWith(
      expect.stringContaining('whisper-cli'),
      expect.arrayContaining(['-f', '/tmp/test.wav', '--output-txt']),
      expect.any(Object),
      expect.any(Function)
    )
    expect(result).toBe('Hello world')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
yarn test src/main/transcriber.test.ts
```

Expected: FAIL.

**Step 3: Write implementation**

`src/main/transcriber.ts`:
```typescript
import { execFile } from 'child_process'
import { readFileSync, unlinkSync } from 'fs'
import path from 'path'
import { app } from 'electron'

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

    execFile(bin, args, { timeout: 30000 }, (err) => {
      if (err) return reject(err)
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
```

**Step 4: Run tests to verify they pass**

```bash
yarn test src/main/transcriber.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/transcriber.ts src/main/transcriber.test.ts
git commit -m "feat: whisper-cli transcriber"
```

---

## Task 8: Summarizer (Ollama Streaming)

**Files:**
- Create: `src/main/summarizer.ts`
- Create: `src/main/summarizer.test.ts`

**Step 1: Write failing tests**

`src/main/summarizer.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Summarizer', () => {
  it('streams tokens from Ollama and yields them', async () => {
    const chunks = [
      JSON.stringify({ response: 'Hello', done: false }) + '\n',
      JSON.stringify({ response: ' world', done: false }) + '\n',
      JSON.stringify({ response: '', done: true }) + '\n',
    ]
    const encoder = new TextEncoder()
    let i = 0
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) yield encoder.encode(chunk)
      }
    }
    mockFetch.mockResolvedValue({ ok: true, body: mockStream })

    const { summarize } = await import('./summarizer')
    const tokens: string[] = []
    for await (const token of summarize('Hello rambling text', 'Be concise.')) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['Hello', ' world'])
  })

  it('throws if Ollama is not reachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const { summarize } = await import('./summarizer')
    const gen = summarize('text', 'prompt')
    await expect(gen.next()).rejects.toThrow('ECONNREFUSED')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
yarn test src/main/summarizer.test.ts
```

Expected: FAIL.

**Step 3: Write implementation**

`src/main/summarizer.ts`:
```typescript
const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'llama3.2:3b'

export async function* summarize(rawText: string, systemPrompt: string): AsyncGenerator<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${systemPrompt}\n\nTranscription:\n${rawText}`,
      stream: true,
    }),
  })

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
  if (!response.body) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of response.body as any) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const data = JSON.parse(line)
      if (data.response) yield data.response
      if (data.done) return
    }
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/', { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

export async function pullModel(onProgress: (status: string) => void): Promise<void> {
  const response = await fetch('http://localhost:11434/api/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: MODEL, stream: true }),
  })
  const decoder = new TextDecoder()
  for await (const chunk of response.body as any) {
    const line = decoder.decode(chunk)
    try {
      const data = JSON.parse(line)
      if (data.status) onProgress(data.status)
    } catch { /* ignore partial lines */ }
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
yarn test src/main/summarizer.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/summarizer.ts src/main/summarizer.test.ts
git commit -m "feat: Ollama streaming summarizer"
```

---

## Task 9: Auto-Typer

**Files:**
- Create: `src/main/typer.ts`
- Create: `src/main/typer.test.ts`

**Step 1: Write failing tests**

`src/main/typer.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

const mockExecSync = vi.fn()
vi.mock('child_process', () => ({ execSync: mockExecSync }))

describe('Typer', () => {
  it('captures frontmost app name', async () => {
    mockExecSync.mockReturnValue(Buffer.from('iTerm2\n'))
    const { getFrontmostApp } = await import('./typer')
    const app = getFrontmostApp()
    expect(app).toBe('iTerm2')
  })

  it('types text into the given app via osascript', async () => {
    mockExecSync.mockReturnValue(Buffer.from(''))
    const { typeIntoApp } = await import('./typer')
    typeIntoApp('hello world', 'iTerm2')
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('keystroke'),
      expect.any(Object)
    )
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
yarn test src/main/typer.test.ts
```

Expected: FAIL.

**Step 3: Write implementation**

`src/main/typer.ts`:
```typescript
import { execSync } from 'child_process'
import { clipboard } from 'electron'

export function getFrontmostApp(): string {
  const script = `tell application "System Events" to get name of first application process whose frontmost is true`
  return execSync(`osascript -e '${script}'`, { timeout: 3000 }).toString().trim()
}

export function typeIntoApp(text: string, appName: string): void {
  // Write to clipboard first (reliable fallback)
  clipboard.writeText(text)

  // Escape text for AppleScript string literal
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  const script = [
    `tell application "${appName}" to activate`,
    `delay 0.1`,
    `tell application "System Events"`,
    `  keystroke "${escaped}"`,
    `end tell`,
  ].join('\n')

  try {
    execSync(`osascript -e '${script}'`, { timeout: 5000 })
  } catch {
    // Silently fail — text is already on clipboard as fallback
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
yarn test src/main/typer.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/typer.ts src/main/typer.test.ts
git commit -m "feat: auto-typer with frontmost app capture and clipboard fallback"
```

---

## Task 10: Overlay Window

**Files:**
- Create: `src/main/overlay-window.ts`
- Create: `src/overlay/index.html`
- Create: `src/overlay/overlay.css`
- Create: `src/overlay/overlay.js`

**Step 1: Write `src/main/overlay-window.ts`**

```typescript
import { BrowserWindow, screen, ipcMain } from 'electron'
import path from 'path'

let overlayWin: BrowserWindow | null = null

export function showOverlay(): BrowserWindow {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.show()
    return overlayWin
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWin = new BrowserWindow({
    width: 520,
    height: 140,
    x: Math.round(width / 2 - 260),
    y: Math.round(height - 220),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false, // Don't steal focus from the target app
    skipTaskbar: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'overlay-preload.js'),
    },
  })

  overlayWin.loadFile(path.join(__dirname, '../../src/overlay/index.html'))
  overlayWin.setIgnoreMouseEvents(false)
  return overlayWin
}

export function hideOverlay() {
  overlayWin?.hide()
}

export function sendToOverlay(channel: string, ...args: any[]) {
  overlayWin?.webContents.send(channel, ...args)
}
```

**Step 2: Write `src/overlay/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="overlay.css">
</head>
<body>
  <div id="app">
    <div id="recording-state" class="state active">
      <canvas id="waveform"></canvas>
      <div class="controls">
        <span class="logo">▲</span>
        <div class="buttons">
          <button id="stop-btn">Stop <kbd>⌥Space</kbd></button>
          <button id="cancel-btn" class="secondary">Cancel <kbd>esc</kbd></button>
        </div>
      </div>
    </div>
    <div id="processing-state" class="state">
      <div class="status-text">Transcribing...</div>
    </div>
    <div id="streaming-state" class="state">
      <div id="output-text"></div>
      <div class="controls">
        <span class="logo">▲</span>
        <button id="close-btn" class="secondary">Close <kbd>esc</kbd></button>
      </div>
    </div>
  </div>
  <script src="overlay.js"></script>
</body>
</html>
```

**Step 3: Write `src/overlay/overlay.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  background: transparent;
  overflow: hidden;
  border-radius: 16px;
}

#app {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.08);
  padding: 20px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.state { display: none; }
.state.active { display: flex; flex-direction: column; gap: 16px; }

#waveform { width: 100%; height: 60px; }

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo { font-size: 18px; color: #555; }

.buttons { display: flex; gap: 8px; align-items: center; }

button {
  background: #000;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

button.secondary {
  background: rgba(0,0,0,0.08);
  color: #333;
}

kbd {
  background: rgba(255,255,255,0.3);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 11px;
}

.status-text {
  color: #666;
  font-size: 14px;
  text-align: center;
  padding: 20px;
}

#output-text {
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  max-height: 200px;
  overflow-y: auto;
  flex: 1;
}
```

**Step 4: Write `src/overlay/overlay.js`**

```javascript
// State management
function showState(id) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

// Waveform visualization
const canvas = document.getElementById('waveform')
const ctx = canvas.getContext('2d')
let analyser, animFrame

async function startWaveform() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)
  drawWaveform()
}

function drawWaveform() {
  animFrame = requestAnimationFrame(drawWaveform)
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const barWidth = (canvas.width / data.length) * 2.5
  let x = 0
  for (let i = 0; i < data.length; i++) {
    const barHeight = (data[i] / 255) * canvas.height
    ctx.fillStyle = `rgba(0,0,0,${0.3 + (data[i] / 255) * 0.7})`
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
    x += barWidth + 1
  }
}

function stopWaveform() {
  if (animFrame) cancelAnimationFrame(animFrame)
}

// IPC from main process
window.electronAPI.onState((state, data) => {
  if (state === 'recording') {
    showState('recording-state')
    startWaveform()
  } else if (state === 'processing') {
    stopWaveform()
    showState('processing-state')
  } else if (state === 'streaming') {
    showState('streaming-state')
  } else if (state === 'token') {
    document.getElementById('output-text').textContent += data
  }
})

// Button handlers
document.getElementById('stop-btn').addEventListener('click', () => {
  window.electronAPI.send('overlay-stop')
})
document.getElementById('cancel-btn').addEventListener('click', () => {
  window.electronAPI.send('overlay-cancel')
})
document.getElementById('close-btn').addEventListener('click', () => {
  window.electronAPI.send('overlay-close')
})

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.electronAPI.send('overlay-cancel')
  if (e.key === ' ' && e.altKey) window.electronAPI.send('overlay-stop')
})

// Start in recording state
window.electronAPI.onReady(() => showState('recording-state'))
```

**Step 5: Create the overlay preload**

`src/main/overlay-preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onState: (cb: (state: string, data?: string) => void) => {
    ipcRenderer.on('overlay-state', (_e, state, data) => cb(state, data))
  },
  onReady: (cb: () => void) => {
    ipcRenderer.on('overlay-ready', () => cb())
  },
  send: (channel: string) => {
    ipcRenderer.send(channel)
  },
})
```

**Step 6: Test manually**

```bash
yarn dev
```

Expected: overlay window appears on demand (wire into hotkey in next task).

**Step 7: Commit**

```bash
git add src/main/overlay-window.ts src/main/overlay-preload.ts src/overlay/
git commit -m "feat: floating overlay window with waveform and streaming states"
```

---

## Task 11: Global Hotkey + Pipeline

**Files:**
- Create: `src/main/hotkey.ts`
- Create: `src/main/pipeline.ts`
- Modify: `src/main/index.ts`

**Step 1: Write `src/main/hotkey.ts`**

```typescript
import { globalShortcut } from 'electron'

const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'

export function registerHotkey(onTrigger: () => void): void {
  const registered = globalShortcut.register(DEFAULT_HOTKEY, onTrigger)
  if (!registered) console.error('Hotkey registration failed')
}

export function unregisterAll() {
  globalShortcut.unregisterAll()
}
```

**Step 2: Write `src/main/pipeline.ts`**

This orchestrates the full record → transcribe → summarize → type flow.

```typescript
import { ipcMain } from 'electron'
import { Recorder } from './recorder'
import { transcribe } from './transcriber'
import { summarize } from './summarizer'
import { getFrontmostApp, typeIntoApp } from './typer'
import { showOverlay, hideOverlay, sendToOverlay } from './overlay-window'
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
  win.webContents.once('did-finish-load', () => {
    sendToOverlay('overlay-state', 'recording')
    recorder.start()
  })

  ipcMain.once('overlay-stop', () => stopRecording())
  ipcMain.once('overlay-cancel', () => cancelPipeline())
}

async function stopRecording() {
  const wavPath = recorder.stop()
  sendToOverlay('overlay-state', 'processing')

  try {
    const rawText = await transcribe(wavPath)
    const modes = loadModes()
    const activeMode = modes.find(m => m.id === getActiveModeId()) ?? modes[0]

    sendToOverlay('overlay-state', 'streaming')

    let fullText = ''
    for await (const token of summarize(rawText, activeMode.prompt)) {
      fullText += token
      sendToOverlay('overlay-state', 'token', token)
    }

    // Output: auto-type + clipboard (already written in summarizer via typeIntoApp)
    if (frontmostApp) typeIntoApp(fullText, frontmostApp)

  } catch (err) {
    console.error('Pipeline error:', err)
    hideOverlay()
  } finally {
    isRunning = false
  }
}

function cancelPipeline() {
  if (recorder.isRecording) recorder.stop()
  hideOverlay()
  isRunning = false
  ipcMain.removeAllListeners('overlay-stop')
}

ipcMain.on('overlay-close', () => {
  hideOverlay()
})
```

**Step 3: Wire everything into `src/main/index.ts`**

```typescript
import { app } from 'electron'
import { setupTray } from './tray'
import { loadModes } from './modes'
import { registerHotkey, unregisterAll } from './hotkey'
import { startPipeline } from './pipeline'

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
app.dock?.hide()

app.whenReady().then(async () => {
  setupTray(
    (mode) => console.log('Mode:', mode.name),
    () => console.log('TODO: open preferences')
  )
  registerHotkey(() => startPipeline())
})

app.on('will-quit', () => unregisterAll())
app.on('window-all-closed', () => {})
```

**Step 4: Smoke test the full pipeline**

```bash
yarn dev
```

1. Press `⌘⇧Space` — overlay should appear with waveform
2. Say something for a few seconds
3. Click Stop — overlay shows "Transcribing...", then streams output
4. Text should auto-type into the previously focused app
5. Press Esc to close overlay

**Step 5: Commit**

```bash
git add src/main/hotkey.ts src/main/pipeline.ts src/main/index.ts
git commit -m "feat: global hotkey + full record→transcribe→summarize→type pipeline"
```

---

## Task 12: Preferences Window

**Files:**
- Create: `src/main/preferences-window.ts`
- Create: `src/preferences/index.html`
- Create: `src/preferences/prefs.css`
- Create: `src/preferences/prefs.js`
- Modify: `src/main/index.ts`

**Step 1: Write `src/main/preferences-window.ts`**

```typescript
import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { loadModes, saveModes, Mode } from './modes'

let prefsWin: BrowserWindow | null = null

export function openPreferences() {
  if (prefsWin && !prefsWin.isDestroyed()) {
    prefsWin.focus()
    return
  }

  prefsWin = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'Blurt Preferences',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'prefs-preload.js'),
    },
  })

  prefsWin.loadFile(path.join(__dirname, '../../src/preferences/index.html'))
}

// IPC handlers for prefs window
ipcMain.handle('get-modes', () => loadModes())
ipcMain.handle('save-modes', (_e, modes: Mode[]) => saveModes(modes))
```

**Step 2: Write `src/main/prefs-preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('prefsAPI', {
  getModes: () => ipcRenderer.invoke('get-modes'),
  saveModes: (modes: any[]) => ipcRenderer.invoke('save-modes', modes),
})
```

**Step 3: Write `src/preferences/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Blurt Preferences</title>
  <link rel="stylesheet" href="prefs.css">
</head>
<body>
  <h1>Modes</h1>
  <div id="modes-list"></div>
  <button id="add-btn">+ Add Mode</button>
  <div id="editor" class="hidden">
    <h2 id="editor-title">Edit Mode</h2>
    <label>Name <input id="mode-name" type="text"></label>
    <label>Prompt <textarea id="mode-prompt" rows="4"></textarea></label>
    <div class="editor-actions">
      <button id="save-btn">Save</button>
      <button id="delete-btn" class="danger">Delete</button>
      <button id="cancel-btn" class="secondary">Cancel</button>
    </div>
  </div>
  <script src="prefs.js"></script>
</body>
</html>
```

**Step 4: Write `src/preferences/prefs.css`** — basic readable styles (body padding, input widths, button styles). Keep it minimal — this is a utility, not a showcase.

**Step 5: Write `src/preferences/prefs.js`** — load modes via `prefsAPI.getModes()`, render list, open editor on click, save via `prefsAPI.saveModes()`. Standard DOM manipulation, no framework needed.

**Step 6: Wire into tray**

In `src/main/index.ts`, replace `console.log('TODO: open preferences')` with `openPreferences()`.

**Step 7: Test manually** — open preferences from tray, edit a mode, verify it persists after restart.

**Step 8: Commit**

```bash
git add src/main/preferences-window.ts src/main/prefs-preload.ts src/preferences/
git commit -m "feat: preferences window for mode CRUD"
```

---

## Task 13: Setup Wizard

**Files:**
- Create: `src/main/setup.ts`
- Create: `src/setup/index.html`
- Modify: `src/main/index.ts`

**Step 1: Write `src/main/setup.ts`**

```typescript
import { BrowserWindow, ipcMain, shell, systemPreferences } from 'electron'
import path from 'path'
import { isOllamaRunning, pullModel } from './summarizer'

export async function runSetupIfNeeded(): Promise<void> {
  const ollamaReady = await isOllamaRunning()
  const micGranted = systemPreferences.getMediaAccessStatus('microphone') === 'granted'

  if (ollamaReady && micGranted) return // Nothing to do

  await showSetupWindow({ ollamaReady, micGranted })
}

function showSetupWindow(status: { ollamaReady: boolean; micGranted: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 480,
      height: 400,
      title: 'Blurt Setup',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'setup-preload.js'),
      },
    })

    win.loadFile(path.join(__dirname, '../../src/setup/index.html'))

    ipcMain.handle('setup-status', () => status)
    ipcMain.handle('open-ollama', () => shell.openExternal('https://ollama.com'))
    ipcMain.handle('check-ollama', () => isOllamaRunning())
    ipcMain.handle('pull-model', async (_e) => {
      win.webContents.send('pull-progress', 'Starting download...')
      await pullModel((s) => win.webContents.send('pull-progress', s))
      win.webContents.send('pull-progress', 'done')
    })
    ipcMain.handle('request-mic', async () => {
      await systemPreferences.askForMediaAccess('microphone')
      return systemPreferences.getMediaAccessStatus('microphone') === 'granted'
    })
    ipcMain.handle('setup-complete', () => {
      win.close()
      resolve()
    })

    win.on('closed', () => resolve())
  })
}
```

**Step 2: Write `src/setup/index.html`** — a simple step-by-step HTML page:
1. If Ollama not running: show "Install Ollama" button + "I've installed it — check again" button + pull model progress
2. If mic not granted: show "Grant Microphone Access" button
3. "Done" button calls `setup-complete`

**Step 3: Wire into `src/main/index.ts`**

```typescript
app.whenReady().then(async () => {
  await runSetupIfNeeded()
  setupTray(...)
  registerHotkey(...)
})
```

**Step 4: Test manually** — first run should show wizard. Subsequent runs should skip it.

**Step 5: Commit**

```bash
git add src/main/setup.ts src/setup/
git commit -m "feat: first-run setup wizard (Ollama + microphone permissions)"
```

---

## Task 14: electron-builder DMG Packaging

**Files:**
- Modify: `electron-builder.yml`
- Modify: `package.json`

**Step 1: Finalize `electron-builder.yml`**

Ensure `extraResources` copies the `bin/` directory (whisper-cli + model) into the app bundle's `Resources/bin/`. The transcriber already handles the `app.isPackaged` path.

**Step 2: Add build script to `package.json`**

```json
"scripts": {
  "dist": "yarn build && electron-builder --mac --arm64"
}
```

**Step 3: Build the DMG**

```bash
yarn download-assets   # if not already done
yarn dist
```

Expected: `dist-app/Blurt-0.1.0-arm64.dmg` created.

**Step 4: Install and smoke test**

```bash
open dist-app/Blurt-0.1.0-arm64.dmg
```

Drag to Applications, launch, verify:
- No Dock icon
- Menubar icon appears
- Hotkey works
- Full pipeline completes end-to-end
- Text auto-typed at cursor

**Step 5: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "chore: electron-builder DMG config for arm64 macOS"
```

---

## Task 15: README

**Files:**
- Create: `README.md`

Document:
1. What Blurt is (2 sentences)
2. Prerequisites (Xcode tools, Homebrew, Ollama, Node 20+, yarn)
3. Build from source: `yarn install && yarn download-assets && yarn dist`
4. Default hotkey: `⌘⇧Space`
5. Modes and how to edit them
6. Known limitations (long audio files, first-run Ollama setup)

Commit: `docs: add README`

---

## Smoke Test Checklist (manual, after DMG install)

- [ ] App launches, no Dock icon, menubar icon visible
- [ ] Tray menu shows 4 modes, switching works
- [ ] `⌘⇧Space` opens overlay with waveform animation
- [ ] Stop button / `⌥Space` stops recording and triggers pipeline
- [ ] Overlay shows "Transcribing..." then streams output tokens
- [ ] Output auto-typed into previously focused app (tested in: Terminal, Notes, Claude Code)
- [ ] Text also available on clipboard
- [ ] `Esc` cancels at any stage
- [ ] Preferences window opens, mode CRUD works, persists across restart
- [ ] First-run wizard skipped on subsequent launches
- [ ] `yarn dist` produces working DMG from clean clone + `yarn download-assets`
