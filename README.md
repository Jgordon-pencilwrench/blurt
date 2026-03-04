# Blurt

A macOS menubar app that captures voice, transcribes offline with Whisper, summarises with a local LLM, and types the result at your cursor — no cloud, no latency, no data leaving your machine.

## Prerequisites

- **Xcode Command Line Tools:** `xcode-select --install`
- **Homebrew:** `brew install cmake sox`
- **Ollama:** https://ollama.com — install and run once, then `ollama pull llama3.2:3b`
- **Node.js 20+** and **yarn**

## Build from source

```bash
yarn install
yarn download-assets   # compiles whisper.cpp with Metal (~2 min) + downloads model
yarn dist              # produces dist-app/Blurt-0.1.0-arm64.dmg
```

## Development

```bash
yarn dev    # build TypeScript + launch Electron
yarn test   # run unit tests
```

## Usage

- **Default hotkey:** `⌃⌥Space` (Ctrl+Option+Space)
- Press hotkey → speak → click **Stop** (or press `⌥Space`)
- Blurt transcribes, summarises, and types the result into the app you were in
- Text is always copied to clipboard as a fallback

## Modes

Four built-in modes, selectable from the menubar:

| Mode | What it does |
|---|---|
| **Quick Note** | Compresses to bullet-pointed gist |
| **Message** | Cleans up into conversational prose |
| **Agent** | Terse, technical — for pasting into AI agents |
| **Dev Note** | Preserves code identifiers, bullet-points steps |

Edit modes or add your own via **Preferences…** in the menubar.

## Permissions (first run)

The setup wizard guides you through:
1. **Ollama running** — local AI inference
2. **Microphone** — for recording
3. **Accessibility** — for auto-typing at cursor (optional; clipboard fallback works without it)

## Known limitations

- First transcription after cold start is slow (~5–10s) while Metal warms up; subsequent ones are faster
- Long recordings (>60s) may time out — keep it under a minute
- Ollama must be running before launching Blurt; the setup wizard will prompt if it's not
