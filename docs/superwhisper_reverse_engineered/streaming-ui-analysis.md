# SuperWhisper Streaming UI — Reverse Engineered
*How SuperWhisper renders streaming LLM output, and what Blurt should steal.*

---

## Is SuperWhisper an Electron App?

**No.** SuperWhisper is a native macOS app written in Swift using a mix of SwiftUI and AppKit. Evidence from the binary:

- All class names carry the `_TtC12superwhisper` Swift name-mangling prefix
- SwiftUI protocol conformances: `$s7SwiftUI4ViewP`, `$s7SwiftUI19NSViewRepresentableP`, etc.
- The app uses `NSPanel`, `NSWindow`, `NSTextView`, `NSVisualEffect` — all AppKit
- There is exactly **one** `WKWebView` reference (`So9WKWebViewC`) — but it's used only for the streaming text display (see below), not the whole UI

This matters because SuperWhisper's approach is a **hybrid**: native SwiftUI/AppKit shell with a WKWebView inset for the text display area. Blurt (Electron) is already doing the equivalent — the whole overlay is a webview. The gap is in *what* SW renders into that webview.

---

## The Streaming Text Display Architecture

SuperWhisper's result window (`DynamicRecorderPanel` / `DynamicRecorderView`) is a native SwiftUI panel. Inside it, the text display area is an `HTMLView` — a `WKWebView` wrapped in an `NSViewRepresentable`. Source file: `HTMLView.swift`.

The HTML document loaded into the WKWebView is **constructed in Swift at runtime** and injected via `evaluateJavaScript`. When streaming tokens arrive, Swift calls `evaluateJavaScript` to run update scripts that mutate the DOM directly — no page reload, no re-render of the whole document.

There are two distinct rendering pipelines: **streaming** (during LLM output) and **finalized** (after LLM completes).

---

## The Full HTML Template

This is the verbatim HTML skeleton loaded into the WKWebView on every recording (reconstructed from binary strings):

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <style>
    :root {
      color-scheme: light dark;
    }
    * {
        margin: 0;
        font-size: 14px;
    }
    body {
        padding: 0 20px 12px 20px;
        line-height: 1.25;
        font-family: -apple-system;
    }
    /* Scrollable top spacer - replaces fixed body top padding so it
       scrolls away when content overflows, while a mask above
       softens the edge as text scrolls under the top. */
    body::before {
        content: '';
        display: block;
        height: 12px;
    }
    h1 { font-size: 24px; }
    h2 { font-size: 20px; }

    table {
        table-layout: fixed;
        width: 100%;
        border-collapse: collapse;
    }
    table, th, td { border: 1px solid #a3a3a3; }
    @media (prefers-color-scheme: dark) {
        table, th, td { border: 1px solid #737373; }
    }
    th, td {
        vertical-align: top;
        text-align: left;
        padding: 4px;
    }
    p, h1, h2, h3, h4, h5, h6 {
        overflow-wrap: break-word;
        margin-bottom: 0.5em;
    }
    ul, ol { padding-inline-start: 24px; }
    pre {
        white-space: pre-wrap;
        word-wrap: break-word;
    }

    /* ── Blinking cursor (waiting state) ── */
    @keyframes cursor-blink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.2; }
    }
    .waiting-cursor {
        display: inline-block;
        width: 2px;
        height: 1em;
        background-color: currentColor;
        border-radius: 1px;
        animation: cursor-blink 1.8s ease-in-out infinite;
        vertical-align: middle;
    }

    /* ── Waveform cursor (recording state) ── */
    @keyframes waveform-idle {
        0%, 100% { transform: scaleY(0.4); }   /* scale varies per bar */
        50%       { transform: scaleY(1); }
    }
    .waveform-cursor { /* inline-flex, 3 bars side by side */ }
    .waveform-cursor .bar {
        /* each bar animates with different duration: 0.9s, 1.1s, 1.3s */
        animation: waveform-idle 0.9s ease-in-out infinite;
    }
    .waveform-cursor.active .bar {
        /* heights set via JS from live audio level */
    }

    /* ── Wave reveal (streaming token animation) ── */
    @keyframes wave-char-reveal {
        0%   { max-width: 0;   opacity: 0;   filter: blur(8px); }
        40%  { max-width: 1em; opacity: 0.5; filter: blur(4px); }
        100% { max-width: 1em; opacity: 1;   filter: blur(0px); }
    }
    .wave-char {
        display: inline-block;
        max-width: 0;
        opacity: 0;
        overflow: hidden;
        white-space: pre;
        vertical-align: bottom;
        filter: blur(4px);
        animation: wave-char-reveal 0.3s cubic-bezier(0.215, 0.61, 0.355, 1.0) forwards;
    }
    .wave-reveal-container {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: baseline;
    }
    .wave-cursor-animated { flex-shrink: 0; }

    /* ── Shimmer effect (finalizing state) ── */
    @keyframes text-shimmer {
        0%, 100% { -webkit-text-fill-color: var(--shimmer-bright); }
        50%       { -webkit-text-fill-color: var(--shimmer-dim); }
    }
    body.shimmer {
        --shimmer-bright: #000000;
        --shimmer-dim: #a1a1aa;
        -webkit-text-fill-color: #000000;
        animation: text-shimmer 2s ease-in-out infinite;
    }
    @media (prefers-color-scheme: dark) {
        body.shimmer {
            --shimmer-bright: #ffffff;
            --shimmer-dim: #71717a;
        }
    }

    /* ── Hide cursors during shimmer and when finalized ── */
    body.shimmer .waveform-cursor,
    body.shimmer .waiting-cursor,
    body.finalized .waveform-cursor,
    body.finalized .waiting-cursor {
        display: none;
    }
    </style>
</head>
<body>
</body>
</html>
```

This document is loaded once. All subsequent updates are DOM mutations via `evaluateJavaScript`.

---

## The Four UI States

SuperWhisper cycles through these states, each corresponding to a different body class and DOM structure:

### 1. Waiting (recording has stopped, STT in progress)

Body content:
```html
<span>&nbsp;</span><span class="waiting-cursor"></span>
```

A blinking `2px` vertical bar cursor. Simple and minimal.

### 2. Streaming (LLM is outputting tokens)

The waveform cursor replaces the waiting cursor:
```html
<span class="waveform-cursor">
  <span class="bar"></span>
  <span class="bar"></span>
  <span class="bar"></span>
</span>
```

New tokens are rendered as **wave-reveal spans**. Each token (or small chunk) is wrapped in a container with staggered per-character animation:

```html
<p>
  <span class="wave-reveal-container" style="--wave-duration: {ms}">
    <span class="wave-char" style="animation-delay: 0ms">H</span>
    <span class="wave-char" style="animation-delay: 30ms">e</span>
    <span class="wave-char" style="animation-delay: 60ms">y</span>
    <span class="wave-char" style="animation-delay: 0ms">&nbsp;</span>
    <!-- ... -->
    <span class="wave-cursor-animated">
      <span class="waveform-cursor">...</span>
    </span>
  </span>
</p>
```

Each character gets an `animation-delay` that staggers the reveal. The delay is calculated based on character position within the token — roughly `30ms × index`. The cursor floats after the last character.

**Scroll behaviour during streaming**: scroll to `document.body.scrollHeight` — always shows the bottom (latest tokens).

**Large addition fast-path**: If a large block of text arrives at once (e.g. the LLM returns multiple words in a single chunk), it skips the per-character animation and shows the text instantly. Log string: `"[RecordingView] Large addition (%d words) - instant show"`.

### 3. Shimmer (LLM done, finalizing / post-processing)

`document.body.classList.add('shimmer')` is called when the LLM finishes streaming but before the result is committed. This triggers a CSS `text-shimmer` animation on all body text — a gentle pulse between bright and dim (white↔#71717a dark, black↔#a1a1aa light). The cursors are hidden.

**Scroll behaviour**: scroll to `window.scrollTo(0, 0)` — jumps to top to show the beginning of the result.

### 4. Finalized

`document.body.classList.add('finalized')` is called after shimmer. The shimmer animation stops. The body now contains the complete result rendered as Markdown HTML (using `cmark` — a C Markdown parser bundled in the binary). Cursors remain hidden.

The finalized render is a full `document.body.innerHTML = \`...\`` replacement with the cmark-rendered HTML. This is the only full DOM replacement.

---

## The JavaScript Update Script

The single `evaluateJavaScript` call that runs on every token (reconstructed):

```javascript
// Apply shimmer effect
if (isShimmering) {
    document.body.classList.add('shimmer');
} else {
    document.body.classList.remove('shimmer');
}

// Apply finalized state
if (isFinalized) {
    document.body.classList.add('finalized');
} else {
    document.body.classList.remove('finalized');
}

// Update waveform cursor audio level
var cursor = document.querySelector('.waveform-cursor');
var bars = document.querySelectorAll('.waveform-cursor .bar');
if (cursor && bars.length >= 3) {
    if (isActive) {
        cursor.classList.add('active');
        bars[0].style.height = '{level1}px';
        bars[1].style.height = '{level2}px';
        bars[2].style.height = '{level3}px';
    } else {
        cursor.classList.remove('active');
        bars[0].style.height = '';
        bars[1].style.height = '';
        bars[2].style.height = '';
    }
}

// Scroll: top for finalized result, bottom while streaming
if (isFinalized) {
    window.scrollTo(0, 0);
} else {
    window.scrollTo(0, document.body.scrollHeight);
}
```

---

## The `stableText` / `animatingText` Split

Inside the Swift `RealtimeTextAnimationHandler`, text is split into two parts:

- **`stableText`** — already-rendered content that has completed its animation. This is static HTML that stays in the DOM untouched.
- **`animatingText`** — the newest tokens being wave-revealed. This is the trailing portion actively being animated.

This split avoids re-rendering existing text on every token. Only the `animatingText` portion is replaced on each update. Once the animation for a chunk completes (via CSS `animationend` event or a timer), it gets "committed" to `stableText`.

The approach prevents the flicker you'd get from replacing `innerHTML` on the whole document every token.

---

## Markdown Rendering

SuperWhisper bundles **cmark** (the CommonMark C reference implementation) and renders Markdown on the finalized result. This is why the streaming view shows plain tokens but the final result renders as formatted Markdown with headers, bullets, bold, tables, etc.

The rendering pipeline:
1. Stream raw text tokens → append to display as wave-reveal spans
2. On LLM completion → apply shimmer state
3. Run cmark on the full result string → get HTML string
4. Set `document.body.innerHTML` to the rendered HTML → apply finalized state

Blurt already uses `marked.js` for Markdown rendering. The key difference is **when**: SW shows streaming tokens as plain text and only applies Markdown rendering once at the end.

---

## What Blurt Should Steal

Blurt's current overlay renders streaming tokens directly into the DOM via token events from the main process. The result is okay but lacks the polish. Here's what to add, in order of impact:

### 1. The Wave-Reveal Animation

The `wave-char-reveal` animation is the centrepiece. Add this to `overlay.css`:

```css
@keyframes wave-char-reveal {
    0%   { max-width: 0;   opacity: 0;   filter: blur(8px); }
    40%  { max-width: 1em; opacity: 0.5; filter: blur(4px); }
    100% { max-width: 1em; opacity: 1;   filter: blur(0px); }
}
.wave-char {
    display: inline-block;
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    white-space: pre;
    vertical-align: bottom;
    animation: wave-char-reveal 0.3s cubic-bezier(0.215, 0.61, 0.355, 1.0) forwards;
}
.wave-reveal-container {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
}
```

In `overlay.js`, when a token arrives, split it into characters and wrap each in a `<span class="wave-char">` with a staggered `animation-delay`:

```javascript
function renderToken(token) {
    const container = document.createElement('span')
    container.className = 'wave-reveal-container'
    const chars = [...token] // unicode-safe split
    chars.forEach((char, i) => {
        const span = document.createElement('span')
        span.className = 'wave-char'
        span.style.animationDelay = `${i * 30}ms`
        span.textContent = char === ' ' ? '\u00A0' : char
        container.appendChild(span)
    })
    textContainer.appendChild(container)
}
```

### 2. Shimmer → Markdown Finalization

Replace the current approach of streaming into the markdown renderer with SW's two-phase approach:

```javascript
// Phase 1: streaming — append wave-reveal spans, plain text
// Phase 2: on 'done' event — apply shimmer, then replace with marked() output

ipcRenderer.on('overlay-state', (_, state, data) => {
    if (state === 'streaming' && data) {
        appendToken(data)  // wave-reveal
    }
    if (state === 'done') {
        // Shimmer
        document.body.classList.add('shimmer')
        setTimeout(() => {
            // Replace with rendered Markdown
            document.body.classList.remove('shimmer')
            document.body.classList.add('finalized')
            textEl.innerHTML = marked.parse(fullText)
            window.scrollTo(0, 0)
        }, 600)  // shimmer duration
    }
})
```

### 3. The Waiting Cursor

While STT is running (state = `'processing'`), show a blinking cursor instead of a spinner:

```css
@keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
}
.waiting-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background-color: currentColor;
    border-radius: 1px;
    animation: cursor-blink 1.8s ease-in-out infinite;
    vertical-align: middle;
}
```

### 4. Scroll Direction

- During streaming: `window.scrollTo(0, document.body.scrollHeight)` on each token
- On finalized: `window.scrollTo(0, 0)` — scroll to top to read from the beginning

### 5. Large Addition Fast-Path

If `token.split(/\s+/).length > 5` (more than ~5 words in one chunk), skip the per-character animation and append the text directly. This prevents the animation getting queued up and playing out long after the LLM has finished.

```javascript
function appendToken(token) {
    const wordCount = token.trim().split(/\s+/).length
    if (wordCount > 5) {
        // instant
        const span = document.createElement('span')
        span.textContent = token
        textContainer.appendChild(span)
    } else {
        renderToken(token) // wave-reveal
    }
    window.scrollTo(0, document.body.scrollHeight)
}
```
