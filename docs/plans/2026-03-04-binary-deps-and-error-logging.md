# Binary Deps Fix & Error Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix silent crash caused by dynamically-linked binaries and add proper macOS error logging so failures are visible and diagnosable.

**Architecture:** Rebuild whisper-cli and llama-completion with `-DBUILD_SHARED_LIBS=OFF` for self-contained binaries. Add a minimal `logger.ts` writing to `app.getPath('logs')` (`~/Library/Logs/Blurt/main.log`). Add an `error` overlay state so users see failures instead of silent window closure.

**Tech Stack:** Electron, Node.js `fs`, cmake (static build flags), plain HTML/CSS for overlay state.

---

### Task 1: Fix `download-assets.ts` — static cmake flags

**Files:**
- Modify: `scripts/download-assets.ts`

The current cmake commands build shared libraries. On testers' machines the rpath `/private/tmp/llama-cpp-build/build/bin` doesn't exist, so dyld kills the process instantly. Fix: force static linking and remove the openssl (curl) dep from llama.

**Step 1: Open the file and locate the cmake lines**

`scripts/download-assets.ts` lines 54-55 (whisper) and 75-76 (llama).

Current whisper build:
```typescript
run('cmake -B build -DGGML_METAL=ON', WHISPER_TMP)
run('cmake --build build --config Release -j4', WHISPER_TMP)
```

Current llama build:
```typescript
run('cmake -B build -DGGML_METAL=ON', LLAMA_TMP)
run('cmake --build build --config Release -j4', LLAMA_TMP)
```

**Step 2: Replace cmake configure lines with static flags**

Replace the whisper cmake configure line:
```typescript
run('cmake -B build -DGGML_METAL=ON -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release', WHISPER_TMP)
```

Replace the llama cmake configure line:
```typescript
run('cmake -B build -DGGML_METAL=ON -DBUILD_SHARED_LIBS=OFF -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release', LLAMA_TMP)
```

(`-DLLAMA_CURL=OFF` removes the openssl/libssl dependency — that feature is only for llama-cli's built-in model download, unused in Blurt.)

**Step 3: Delete existing binaries and rebuild**

```bash
rm /Users/johngordon/work/blurt/bin/whisper-cli
rm /Users/johngordon/work/blurt/bin/llama-completion
rm -rf /private/tmp/whisper-cpp-build /private/tmp/llama-cpp-build
yarn download-assets
```

This takes 10-20 minutes. Expected output ends with "Assets ready."

**Step 4: Verify no external rpath dependencies**

```bash
otool -L bin/whisper-cli
otool -L bin/llama-completion
```

Expected: ALL lines start with `/usr/lib/` or `/System/Library/`. No `@rpath`, no `/opt/homebrew/`, no `/private/tmp/`.

**Step 5: Commit**

```bash
git add scripts/download-assets.ts bin/whisper-cli bin/llama-completion
git commit -m "fix: rebuild binaries with static linking, remove openssl dep"
```

---

### Task 2: Create `src/main/logger.ts`

**Files:**
- Create: `src/main/logger.ts`

Electron's `console.error` in a packaged app writes to nowhere accessible. The macOS convention is `~/Library/Logs/<AppName>/`. `app.getPath('logs')` returns exactly that path.

**Step 1: Write the failing test**

Create `src/main/logger.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// We test the logger in isolation by pointing it at a temp dir
const TEST_LOG_DIR = path.join(os.tmpdir(), 'blurt-logger-test-' + process.pid)
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'main.log')

// Stub app.getPath before importing logger
vi.mock('electron', () => ({
  app: { getPath: (key: string) => key === 'logs' ? TEST_LOG_DIR : os.tmpdir() }
}))

import { log } from './logger'

describe('logger', () => {
  beforeEach(() => fs.mkdirSync(TEST_LOG_DIR, { recursive: true }))
  afterEach(() => fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true }))

  it('writes an info entry to the log file', () => {
    log.info('hello world')
    const content = fs.readFileSync(TEST_LOG_FILE, 'utf8')
    expect(content).toContain('[INFO]')
    expect(content).toContain('hello world')
  })

  it('writes an error entry with stack trace', () => {
    log.error('something broke', new Error('test error'))
    const content = fs.readFileSync(TEST_LOG_FILE, 'utf8')
    expect(content).toContain('[ERROR]')
    expect(content).toContain('something broke')
    expect(content).toContain('test error')
  })

  it('writes a warn entry', () => {
    log.warn('watch out')
    const content = fs.readFileSync(TEST_LOG_FILE, 'utf8')
    expect(content).toContain('[WARN]')
    expect(content).toContain('watch out')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
yarn test src/main/logger.test.ts
```

Expected: FAIL — "Cannot find module './logger'"

**Step 3: Implement `src/main/logger.ts`**

```typescript
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

function getLogPath(): string {
  const logsDir = app.getPath('logs')
  fs.mkdirSync(logsDir, { recursive: true })
  return path.join(logsDir, 'main.log')
}

function write(level: string, message: string, error?: unknown): void {
  const ts = new Date().toISOString()
  let line = `${ts} [${level}] ${message}`
  if (error instanceof Error) {
    line += `\n  ${error.message}`
    if (error.stack) line += `\n  ${error.stack.split('\n').slice(1).join('\n  ')}`
  } else if (error !== undefined) {
    line += `\n  ${String(error)}`
  }
  line += '\n'
  try {
    fs.appendFileSync(getLogPath(), line)
  } catch {
    // Last resort: if we can't write to the log, at least print to stderr
    process.stderr.write(line)
  }
}

export const log = {
  info:  (message: string, error?: unknown) => write('INFO',  message, error),
  warn:  (message: string, error?: unknown) => write('WARN',  message, error),
  error: (message: string, error?: unknown) => write('ERROR', message, error),
}
```

**Step 4: Run test to verify it passes**

```bash
yarn test src/main/logger.test.ts
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/main/logger.ts src/main/logger.test.ts
git commit -m "feat: add file-based logger writing to ~/Library/Logs/Blurt/"
```

---

### Task 3: Register global error handlers in `index.ts`

**Files:**
- Modify: `src/main/index.ts`

Uncaught exceptions and unhandled promise rejections in the main process currently crash silently. Register handlers before `app.whenReady()`.

**Step 1: Read current `src/main/index.ts`**

Current content (no error handlers, no log imports).

**Step 2: Add log import and global handlers**

Add after existing imports:
```typescript
import { log } from './logger'
```

Add immediately after the single-instance lock check (before `app.whenReady()`):
```typescript
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', err)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)))
})
```

**Step 3: Add startup log entry inside `app.whenReady()`**

At the top of the `app.whenReady().then(async () => {` callback, add:
```typescript
log.info(`Blurt starting — pid ${process.pid}`)
```

**Step 4: Run the app in dev to confirm no TypeScript errors**

```bash
yarn build
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: register global uncaughtException/unhandledRejection handlers"
```

---

### Task 4: Add error state to overlay HTML + CSS

**Files:**
- Modify: `src/overlay/index.html`
- Modify: `src/overlay/overlay.css`

The overlay has no way to show errors. Add a fourth state that shows a red error message and auto-closes.

**Step 1: Add error state div to `src/overlay/index.html`**

After the closing `</div>` of `streaming-state` (line 39), add:
```html
    <div id="error-state" class="state">
      <div class="error-icon">✕</div>
      <div id="error-text" class="error-text">An error occurred</div>
      <div class="error-hint">Check ~/Library/Logs/Blurt/main.log for details</div>
    </div>
```

**Step 2: Add error state styles to `src/overlay/overlay.css`**

Append to end of file:
```css
/* ── Error state ─────────────────────────────────────────── */
.error-icon {
  font-size: 22px;
  color: rgba(255, 80, 80, 0.85);
  text-align: center;
  padding-top: 18px;
}

.error-text {
  color: rgba(255, 100, 100, 0.9);
  font-size: 13px;
  text-align: center;
  padding: 4px 8px 0;
  letter-spacing: 0.03em;
  word-break: break-word;
}

.error-hint {
  font-size: 10px;
  color: rgba(255,245,220,0.30);
  text-align: center;
  padding-top: 6px;
  font-family: 'Menlo', 'Monaco', monospace;
}
```

**Step 3: Add error state handler to `src/overlay/overlay.js`**

In the `window.electronAPI.onState((state, data) => {` handler (around line 161), add a new `else if` branch after the `done` handler:
```javascript
  } else if (state === 'error') {
    stopWaveform()
    document.getElementById('error-text').textContent = data || 'An error occurred'
    showState('error-state')
  }
```

**Step 4: Visually verify in dev**

```bash
yarn dev
```

Trigger a recording. No need to test the error state yet — just confirm the app still launches and works normally.

**Step 5: Commit**

```bash
git add src/overlay/index.html src/overlay/overlay.js src/overlay/overlay.css
git commit -m "feat: add error state to overlay UI"
```

---

### Task 5: Wire logger + error state into `pipeline.ts`

**Files:**
- Modify: `src/main/pipeline.ts`

This is the payoff: replace silent `hideOverlay()` on error with logging + visible error state + delayed close.

**Step 1: Add log import to `pipeline.ts`**

Add to imports at top:
```typescript
import { log } from './logger'
```

**Step 2: Replace the catch block in `stopRecording()`**

Current (lines 83-86):
```typescript
  } catch (err) {
    console.error('Pipeline error:', err)
    hideOverlay()
  }
```

Replace with:
```typescript
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('Pipeline error', err instanceof Error ? err : new Error(message))
    sendToOverlay('overlay-state', 'error', message)
    setTimeout(() => hideOverlay(), 4000)
  }
```

**Step 3: Add log call for successful completions**

After `sendToOverlay('overlay-state', 'done', ...)` (both branches), add:
```typescript
    log.info(`Pipeline complete — ${canType && frontmostApp ? 'typed into ' + frontmostApp : 'copied to clipboard'}`)
```

(Add this line once, after the if/else block that sends 'done'.)

**Step 4: Run TypeScript build to catch any errors**

```bash
yarn build
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/main/pipeline.ts
git commit -m "fix: log pipeline errors to file and show error state in overlay"
```

---

### Task 6: Add logging to `transcriber.ts` and `summarizer.ts`

**Files:**
- Modify: `src/main/transcriber.ts`
- Modify: `src/main/summarizer.ts`

Log the full command + paths at each subprocess invocation so we can see exactly what failed and where.

**Step 1: Add log import and path logging to `transcriber.ts`**

Add import:
```typescript
import { log } from './logger'
```

Inside `transcribe()`, just before `execFile(bin, args, ...)`, add:
```typescript
    log.info(`transcribe: ${bin} -m ${model} -f ${wavPath}`)
```

In the error callback inside `execFile`, add before `return reject(err)`:
```typescript
      if (err) {
        log.error(`whisper-cli failed`, err)
        return reject(err)
      }
```

**Step 2: Add log import and path logging to `summarizer.ts`**

Add import:
```typescript
import { log } from './logger'
```

Inside `summarize()`, just before `spawn(getLlamaBinaryPath(), ...)`, add:
```typescript
  log.info(`summarize: ${getLlamaBinaryPath()} -m ${modelPath}`)
```

In the `child.on('error', ...)` handler, add a log call:
```typescript
  child.on('error', (err) => {
    log.error('llama-completion spawn error', err)
    reject(err)
  })
```

In the `child.on('close', ...)` handler, on the rejection branch:
```typescript
  child.on('close', (code) => {
    if (code !== 0 && code !== null) {
      const msg = `llama-completion exited with code ${code}: ${errOutput.slice(-500)}`
      log.error(msg)
      reject(new Error(msg))
    } else {
      resolve()
    }
  })
```

**Step 3: Build and run**

```bash
yarn build && yarn dev
```

Do a test recording. Check `~/.config/blurt/logs/main.log` (dev) — you should see the binary paths logged.

Actually in dev, `app.getPath('logs')` returns a path inside the Electron app support dir. Check:
```bash
ls ~/Library/Logs/Blurt/ 2>/dev/null || ls ~/Library/Logs/Electron/ 2>/dev/null
```

**Step 4: Commit**

```bash
git add src/main/transcriber.ts src/main/summarizer.ts
git commit -m "feat: log subprocess invocations and errors in transcriber and summarizer"
```

---

### Task 7: Run full test suite and verify

**Step 1: Run all tests**

```bash
yarn test
```

Expected: all existing tests pass. The new `logger.test.ts` passes.

**Step 2: Build the DMG to verify bundling**

```bash
yarn dist
```

Expected: `dist-app/Blurt-0.1.0-arm64.dmg` created without errors.

**Step 3: Verify binaries in the built app have no external rpath deps**

```bash
otool -L dist-app/mac-arm64/Blurt.app/Contents/Resources/bin/llama-completion
otool -L dist-app/mac-arm64/Blurt.app/Contents/Resources/bin/whisper-cli
```

Expected: only `/usr/lib/` and `/System/Library/` entries.

**Step 4: Final commit if any cleanup needed, then tag**

```bash
git log --oneline -8
```

Confirm all task commits are present.
