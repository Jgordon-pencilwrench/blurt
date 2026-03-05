# Design: Fix Binary Dependencies & Add Error Logging

**Date:** 2026-03-04
**Status:** Approved

## Problem

Testers report the transcriber overlay closes immediately after transcription completes. Root causes:

1. **`llama-completion` and `whisper-cli` are dynamically linked** against shared libraries that only exist on the developer's build machine (`/private/tmp/llama-cpp-build/build/bin`, `/private/tmp/whisper-cpp-build/build/...`). The binary also hardcodes `/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib`. On any other machine, `dyld` kills the subprocess immediately.

2. **Pipeline errors are silent.** The `pipeline.ts` catch block calls `console.error` (which goes nowhere in a packaged app) and `hideOverlay()`. Testers see the window close with no explanation.

## Solution

### 1. Static binary builds

Rebuild both binaries with `-DBUILD_SHARED_LIBS=OFF` so all llama.cpp/whisper.cpp symbols are compiled into the executable. Add `-DLLAMA_CURL=OFF` to drop the openssl dependency from `llama-completion` (only needed for llama-cli's model download feature, unused here).

Resulting binaries depend only on `/usr/lib` and `/System/Library` — always available on macOS. This approach is CI-safe: GitHub Actions macOS runners need only Xcode CLT, no Homebrew.

### 2. File-based logging (macOS Electron standard)

Add `src/main/logger.ts`:
- Writes to `app.getPath('logs')` → `~/Library/Logs/Blurt/main.log`
- Append-only, timestamped JSON-lines format
- Exposed as `log.info()`, `log.error()`, `log.warn()`

Register in `index.ts`:
- `process.on('uncaughtException', ...)`
- `process.on('unhandledRejection', ...)`

Log at pipeline error sites: transcriber, summarizer, pipeline catch block.

### 3. Error state in overlay

Add an `error` overlay state that shows the error message in red. `pipeline.ts` sends `overlay-state, 'error', message` before auto-closing (3s delay). This gives testers visible, reportable feedback.

## Architecture

No new npm dependencies. Logger is a plain Node.js `fs.appendFileSync` wrapper. Overlay gets one new HTML state element.

## Files Changed

- `scripts/download-assets.ts` — add static cmake flags
- `src/main/logger.ts` — new logger module
- `src/main/index.ts` — register global error handlers
- `src/main/pipeline.ts` — use logger, send error state to overlay
- `src/main/transcriber.ts` — log errors
- `src/main/summarizer.ts` — log errors
- `src/overlay/index.html` — add error state element
- `src/overlay/overlay.js` — handle error state
- `src/overlay/overlay.css` — error state styles
