# Marketing Page Design — Blurt

**Date:** 2026-03-04
**Audience:** Developers and power users
**Visual style:** Premium Apple-native (frosted glass, SF Pro/Inter, dark mode, macOS vibrancy)

---

## Goal

A single-page HTML marketing site that communicates Blurt's value proposition to developers and power users. No exaggeration — only features confirmed in the codebase.

---

## Sections

### 1. Hero

- **Headline:** `Your voice. Instantly typed. Completely private.`
- **Subhead:** One hotkey. Speak. Blurt transcribes, refines, and types it — all on your Mac, never touching a server.
- **CTA:** Download for Mac (arm64)
- **Visual:** Animated floating overlay mockup — waveform pulsing, token-by-token text streaming into a text editor. Frosted glass panel, menubar icon in corner.

---

### 2. How It Works (3 steps)

Visual pipeline with icons:

1. **Press** `⌃⌥Space` — overlay appears
2. **Speak** — waveform animates, Whisper transcribes offline
3. **Done** — text is refined by local AI and typed exactly where your cursor is

---

### 3. Feature Grid (4 cards)

- **100% Offline** — Whisper + local LLM. Nothing leaves your Mac.
- **Smart Modes** — Four built-in modes, fully customizable prompts.
- **Auto-Type** — Text lands exactly where your cursor is. No paste required.
- **Live Streaming** — Words appear in real-time as the AI refines your speech.

---

### 4. Modes & Models

#### Models subsection

Headline: *"Three cutting-edge AI brains, running entirely on your Mac."*

| Model | Size | Speed | Best for |
|-------|------|-------|----------|
| Llama 3.2 1B | 0.8 GB | Fastest | Quick captures, low latency |
| SmolLM3 3B ⭐ | 1.9 GB | Balanced | Everyday use — recommended |
| Qwen3 4B | 2.5 GB | Thorough | Richest output, best quality |

Cards with size, speed indicator, "best for" line. Recommended badge on SmolLM3 3B.

#### Modes subsection

Headline: *"A mode for every kind of creation."*

Four mode cards, each with:
- Mode name + icon
- One-sentence description of purpose
- "Best with" model badge

| Mode | Purpose | Best with |
|------|---------|-----------|
| Quick Note | Compresses to bullets, removes filler, preserves names/dates/code | SmolLM3 3B |
| Message | Cleans up into conversational prose, fixes grammar, keeps tone | SmolLM3 3B |
| Agent | Terse, precise instructions for AI coding agents. Preserves identifiers. | Qwen3 4B |
| Dev Note | Bullets/numbered steps, preserves code, flags bugs/gotchas | Qwen3 4B |

**CTA at bottom of section:**
*"None of these fit? Build your own."* → short explainer on the prompt editor in Preferences.

---

### 5. Privacy Statement

"No account. No API key. No internet."
Bold, centered, with a lock icon. Brief paragraph: Whisper.cpp + Llama.cpp run locally with Metal GPU acceleration. Your voice never leaves your machine.

---

### 6. Footer

App icon, version (0.1.0), macOS arm64 badge, download button.

---

## Visual Language

- **Colors:** Dark background (#0d0d0f), frosted glass cards (`backdrop-filter: blur(20px)`), purple/indigo accent (#7c6ff7 or similar)
- **Typography:** SF Pro Display (system-ui), Inter fallback
- **Shadows:** macOS-style layered box shadows
- **Animations:** Smooth scroll reveal (Intersection Observer), waveform pulse in hero, token streaming simulation
- **No heavy JS frameworks** — vanilla JS + CSS only

---

## Constraints

- Single HTML file (inline CSS + JS, no external dependencies beyond web fonts)
- All features mentioned must exist in the codebase (verified)
- macOS arm64 only — be explicit about this
- No fabricated screenshots — use CSS/SVG mockups

---

## Out of Scope

- Actual download link (placeholder `#`)
- Pricing (app appears free/open source)
- Windows/Linux support (macOS arm64 only)
