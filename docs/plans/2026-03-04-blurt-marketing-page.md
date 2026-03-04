# Blurt Marketing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-file `index.html` marketing page for the Blurt macOS app targeting developers and power users, using a premium Apple-native aesthetic.

**Architecture:** Single self-contained `index.html` with inline `<style>` and `<script>` blocks. No build step, no external JS frameworks. Web fonts loaded from Google Fonts (Inter). All mockups are CSS/SVG — no real screenshots.

**Tech Stack:** HTML5, CSS3 (custom properties, backdrop-filter, animations, grid/flexbox), vanilla JS (Intersection Observer for scroll reveal, simulated waveform + token streaming in hero).

---

## Reference Material

- Design doc: `docs/plans/2026-03-04-marketing-page-design.md`
- Superwhisper.com — visual reference for premium macOS app marketing aesthetic
- Blurt features source of truth: `src/main/model-catalog.ts`, `src/main/modes.ts`, `src/main/pipeline.ts`

---

### Task 1: Scaffold the HTML file with design tokens and base styles

**Files:**
- Create: `index.html`

**Step 1: Create the file with document structure, CSS variables, and reset**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blurt — Voice to Text, Instantly. Privately.</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0d0d0f;
      --bg-card: rgba(255,255,255,0.04);
      --bg-card-hover: rgba(255,255,255,0.07);
      --border: rgba(255,255,255,0.08);
      --border-hover: rgba(255,255,255,0.15);
      --accent: #a78bfa;
      --accent-dim: rgba(167,139,250,0.15);
      --accent-glow: rgba(167,139,250,0.3);
      --text-primary: #f5f5f7;
      --text-secondary: rgba(245,245,247,0.6);
      --text-tertiary: rgba(245,245,247,0.35);
      --radius: 16px;
      --radius-sm: 10px;
      --shadow: 0 1px 0 rgba(255,255,255,0.05) inset, 0 20px 60px rgba(0,0,0,0.5);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text-primary);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    /* Utility */
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .glass {
      background: var(--bg-card);
      border: 1px solid var(--border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    /* Scroll reveal */
    .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.6s ease, transform 0.6s ease; }
    .reveal.visible { opacity: 1; transform: none; }
  </style>
</head>
<body>
  <!-- sections go here -->
  <script>
    // Scroll reveal
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  </script>
</body>
</html>
```

**Step 2: Open in browser and verify**
Open `index.html` in a browser. Expected: black page, no errors in console.

**Step 3: Commit**
```bash
git add index.html
git commit -m "feat: scaffold marketing page with design tokens and base styles"
```

---

### Task 2: Navigation bar

**Files:**
- Modify: `index.html` — add `<nav>` before `<script>`

**Step 1: Add nav HTML inside `<body>` before the script tag**

```html
<nav class="nav">
  <div class="container nav-inner">
    <div class="nav-logo">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="7" fill="var(--accent)"/>
        <path d="M8 14 Q14 8 20 14 Q14 20 8 14Z" fill="white" opacity="0.9"/>
      </svg>
      <span>Blurt</span>
    </div>
    <a href="#download" class="nav-cta">Download for Mac</a>
  </div>
</nav>
```

**Step 2: Add nav CSS inside `<style>`**

```css
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(13,13,15,0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}
.nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  height: 56px;
}
.nav-logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 17px; }
.nav-cta {
  background: var(--accent); color: #0d0d0f;
  padding: 8px 18px; border-radius: 20px;
  font-weight: 600; font-size: 14px; text-decoration: none;
  transition: opacity 0.2s;
}
.nav-cta:hover { opacity: 0.85; }
```

**Step 3: Verify** — sticky nav with logo and CTA button visible.

**Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add navigation bar"
```

---

### Task 3: Hero section

**Files:**
- Modify: `index.html` — add hero section + CSS + JS animation

**Step 1: Add hero HTML after `<nav>`**

```html
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-text reveal">
      <div class="hero-badge">macOS · arm64 · 100% Offline</div>
      <h1 class="hero-headline">Your voice.<br>Instantly typed.<br>Completely private.</h1>
      <p class="hero-sub">One hotkey. Speak. Blurt transcribes, refines, and types it — all on your Mac, never touching a server.</p>
      <div class="hero-actions">
        <a href="#download" id="download" class="btn-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1v9M4 7l4 4 4-4M2 14h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>
          Download for Mac
        </a>
        <span class="hero-meta">Free · macOS 13+ · Apple Silicon</span>
      </div>
    </div>
    <div class="hero-visual reveal" style="transition-delay:0.15s">
      <!-- Floating overlay mockup -->
      <div class="overlay-mockup">
        <div class="overlay-card glass">
          <div class="overlay-header">
            <span class="rec-dot"></span>
            <span class="overlay-mode">Quick Note</span>
            <span class="overlay-shortcut">⌥Space to stop</span>
          </div>
          <div class="waveform" id="waveform">
            <!-- bars injected by JS -->
          </div>
          <div class="overlay-output" id="streamOutput"></div>
          <div class="overlay-footer">
            <button class="overlay-btn">Stop</button>
            <button class="overlay-btn overlay-btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="hero-glow"></div>
</section>
```

**Step 2: Add hero CSS**

```css
.hero {
  padding: 160px 0 100px;
  position: relative;
  overflow: hidden;
}
.hero-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
}
.hero-badge {
  display: inline-flex; align-items: center;
  background: var(--accent-dim); color: var(--accent);
  border: 1px solid var(--accent-glow);
  padding: 5px 14px; border-radius: 20px;
  font-size: 12px; font-weight: 500; letter-spacing: 0.03em;
  margin-bottom: 24px;
}
.hero-headline {
  font-size: clamp(40px, 5vw, 60px);
  font-weight: 700; line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 20px;
}
.hero-sub {
  font-size: 18px; color: var(--text-secondary);
  max-width: 420px; margin-bottom: 36px;
}
.hero-actions { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent); color: #0d0d0f;
  padding: 12px 24px; border-radius: 24px;
  font-weight: 600; font-size: 15px; text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 30px var(--accent-glow);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 0 40px var(--accent-glow); }
.hero-meta { font-size: 13px; color: var(--text-tertiary); }

/* Overlay mockup */
.hero-visual { display: flex; justify-content: center; }
.overlay-mockup { perspective: 800px; }
.overlay-card {
  width: 340px;
  padding: 20px;
  transform: rotateY(-8deg) rotateX(4deg);
  transition: transform 0.5s ease;
}
.overlay-card:hover { transform: rotateY(0) rotateX(0); }
.overlay-header {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 16px; font-size: 13px;
}
.rec-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #ff453a;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,69,58,0.4); }
  50% { box-shadow: 0 0 0 5px rgba(255,69,58,0); }
}
.overlay-mode { font-weight: 500; flex: 1; }
.overlay-shortcut { font-size: 11px; color: var(--text-tertiary); }
.waveform {
  display: flex; align-items: center; gap: 3px;
  height: 40px; margin-bottom: 16px;
}
.waveform-bar {
  width: 3px; border-radius: 2px;
  background: var(--accent);
  animation: wave 0.8s ease-in-out infinite;
}
@keyframes wave {
  0%, 100% { transform: scaleY(0.3); opacity: 0.4; }
  50% { transform: scaleY(1); opacity: 1; }
}
.overlay-output {
  font-size: 14px; color: var(--text-secondary);
  min-height: 60px; margin-bottom: 16px;
  line-height: 1.5;
}
.overlay-footer { display: flex; gap: 8px; }
.overlay-btn {
  padding: 7px 16px; border-radius: 8px;
  background: var(--accent); color: #0d0d0f;
  border: none; font-weight: 600; font-size: 13px; cursor: pointer;
}
.overlay-btn-ghost {
  background: transparent; color: var(--text-secondary);
  border: 1px solid var(--border);
}

/* Background glow */
.hero-glow {
  position: absolute; top: 20%; left: 50%; transform: translateX(-50%);
  width: 600px; height: 400px;
  background: radial-gradient(ellipse, rgba(167,139,250,0.12) 0%, transparent 70%);
  pointer-events: none; z-index: -1;
}

@media (max-width: 768px) {
  .hero-inner { grid-template-columns: 1fr; }
  .overlay-card { transform: none; }
}
```

**Step 3: Add JS animations at bottom of `<script>`**

```js
// Waveform bars
const waveform = document.getElementById('waveform');
for (let i = 0; i < 28; i++) {
  const bar = document.createElement('div');
  bar.className = 'waveform-bar';
  bar.style.height = `${Math.random() * 30 + 8}px`;
  bar.style.animationDelay = `${(i * 0.05).toFixed(2)}s`;
  bar.style.animationDuration = `${(0.6 + Math.random() * 0.6).toFixed(2)}s`;
  waveform.appendChild(bar);
}

// Token streaming simulation
const tokens = ['Summarised', ' key points:', '\n• ', 'Follow up', ' with design', ' team\n• ', 'Deadline', ' moved to', ' Friday\n• ', 'Need', ' final', ' approval'];
let idx = 0;
const out = document.getElementById('streamOutput');
function streamNext() {
  if (idx < tokens.length) {
    out.textContent += tokens[idx++];
    setTimeout(streamNext, 180 + Math.random() * 120);
  } else {
    setTimeout(() => { out.textContent = ''; idx = 0; streamNext(); }, 3000);
  }
}
setTimeout(streamNext, 1200);
```

**Step 4: Verify** — hero looks polished, overlay mockup has pulsing rec dot, animated waveform, streaming text.

**Step 5: Commit**
```bash
git add index.html
git commit -m "feat: add hero section with animated overlay mockup"
```

---

### Task 4: How It Works section

**Files:**
- Modify: `index.html` — add section after hero

**Step 1: Add HTML after the hero section**

```html
<section class="section how-it-works">
  <div class="container">
    <div class="section-label reveal">How it works</div>
    <h2 class="section-title reveal">Three seconds from thought to text.</h2>
    <div class="steps reveal">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-key"><kbd>⌃⌥Space</kbd></div>
        <h3>Press</h3>
        <p>Hit your global hotkey from anywhere. The overlay appears instantly over whatever you're working in.</p>
      </div>
      <div class="step-arrow">→</div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-icon">🎙</div>
        <h3>Speak</h3>
        <p>Talk naturally. Whisper transcribes on-device. No lag, no upload, no waiting for the cloud.</p>
      </div>
      <div class="step-arrow">→</div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-icon">✓</div>
        <h3>Done</h3>
        <p>Your AI mode refines the text and types it exactly where your cursor was. You never leave your flow.</p>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Add CSS**

```css
.section { padding: 100px 0; }
.section-label {
  font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 16px;
}
.section-title {
  font-size: clamp(28px, 4vw, 44px); font-weight: 700;
  letter-spacing: -0.02em; margin-bottom: 60px;
  max-width: 600px;
}
.steps {
  display: flex; align-items: flex-start; gap: 20px;
  flex-wrap: wrap;
}
.step {
  flex: 1; min-width: 220px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 32px 28px;
  transition: border-color 0.2s, background 0.2s;
}
.step:hover { border-color: var(--border-hover); background: var(--bg-card-hover); }
.step-num {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--accent-dim); color: var(--accent);
  font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
}
.step-key kbd {
  display: inline-block; background: rgba(255,255,255,0.07);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 4px 10px; font-size: 13px; font-family: inherit;
  margin-bottom: 16px; color: var(--text-primary);
}
.step-icon { font-size: 28px; margin-bottom: 12px; }
.step h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
.step p { font-size: 15px; color: var(--text-secondary); }
.step-arrow {
  font-size: 24px; color: var(--text-tertiary);
  align-self: center; padding-top: 20px;
  flex-shrink: 0;
}
@media (max-width: 640px) { .step-arrow { display: none; } }
```

**Step 3: Verify** — three step cards with arrow connectors, kbd shortcut styled, smooth hover.

**Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add how it works section"
```

---

### Task 5: Feature grid section

**Files:**
- Modify: `index.html`

**Step 1: Add HTML after how-it-works section**

```html
<section class="section features">
  <div class="container">
    <div class="section-label reveal">Features</div>
    <h2 class="section-title reveal">Everything you need. Nothing you don't.</h2>
    <div class="feature-grid reveal">
      <div class="feature-card glass">
        <div class="feature-icon">🔒</div>
        <h3>100% Offline</h3>
        <p>Whisper.cpp and a local LLM run entirely on your machine with Metal GPU acceleration. Your voice never leaves your Mac.</p>
      </div>
      <div class="feature-card glass">
        <div class="feature-icon">⚡</div>
        <h3>Smart Modes</h3>
        <p>Four built-in modes — Quick Note, Message, Agent, Dev Note — each with a tuned prompt. Fully customisable: edit, delete, or create your own.</p>
      </div>
      <div class="feature-card glass">
        <div class="feature-icon">⌨️</div>
        <h3>Auto-Type</h3>
        <p>Text is typed directly where your cursor is via AppleScript. No manual paste. Falls back gracefully to clipboard if accessibility permission is denied.</p>
      </div>
      <div class="feature-card glass">
        <div class="feature-icon">✨</div>
        <h3>Live Streaming</h3>
        <p>Watch your words appear token-by-token as the model processes your speech. Rendered as Markdown in real time.</p>
      </div>
      <div class="feature-card glass">
        <div class="feature-icon">🎛</div>
        <h3>Global Hotkey</h3>
        <p>Default <kbd>⌃⌥Space</kbd> triggers from anywhere — no app switching, no clicking. Fully rebindable in Preferences.</p>
      </div>
      <div class="feature-card glass">
        <div class="feature-icon">📋</div>
        <h3>Menubar Native</h3>
        <p>Lives in your menubar. No Dock presence. Switch modes instantly from the tray menu. Single-instance, always ready.</p>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Add CSS**

```css
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.feature-card {
  padding: 32px 28px;
  transition: border-color 0.2s, transform 0.2s;
}
.feature-card:hover { border-color: var(--border-hover); transform: translateY(-3px); }
.feature-icon { font-size: 32px; margin-bottom: 16px; }
.feature-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
.feature-card p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
.feature-card kbd {
  background: rgba(255,255,255,0.07); border: 1px solid var(--border);
  border-radius: 4px; padding: 2px 6px; font-size: 12px; font-family: inherit;
}
@media (max-width: 900px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .feature-grid { grid-template-columns: 1fr; } }
```

**Step 3: Verify** — 6-card grid, responsive, glass effect on cards.

**Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add feature grid section"
```

---

### Task 6: Models & Modes section

**Files:**
- Modify: `index.html`

**Step 1: Add HTML after features section**

```html
<section class="section models-modes">
  <div class="container">
    <!-- Models -->
    <div class="section-label reveal">Under the hood</div>
    <h2 class="section-title reveal">Three cutting-edge AI brains,<br>running entirely on your Mac.</h2>
    <div class="model-cards reveal">
      <div class="model-card glass">
        <div class="model-name">Llama 3.2 1B</div>
        <div class="model-speed speed-fast">⚡ Fastest</div>
        <div class="model-size">0.8 GB</div>
        <p class="model-desc">Instant results, minimal memory. Best for quick captures where speed matters most.</p>
      </div>
      <div class="model-card glass model-card-featured">
        <div class="model-badge">Recommended</div>
        <div class="model-name">SmolLM3 3B</div>
        <div class="model-speed speed-balanced">⚖️ Balanced</div>
        <div class="model-size">1.9 GB</div>
        <p class="model-desc">The sweet spot. Best balance of speed and output quality for everyday use.</p>
      </div>
      <div class="model-card glass">
        <div class="model-name">Qwen3 4B</div>
        <div class="model-speed speed-capable">🧠 Most Capable</div>
        <div class="model-size">2.5 GB</div>
        <p class="model-desc">Richest, most nuanced output. Worth the extra second for complex summarisation.</p>
      </div>
    </div>

    <!-- Modes -->
    <div class="modes-header reveal">
      <h2 class="section-title" style="margin-bottom:16px">A mode for every kind of creation.</h2>
      <p class="modes-subhead">Each mode is a tuned system prompt that shapes how Blurt refines your speech.</p>
    </div>
    <div class="mode-cards reveal">
      <div class="mode-card glass">
        <div class="mode-top">
          <div class="mode-icon">📝</div>
          <div class="mode-info">
            <h3>Quick Note</h3>
            <p>Compresses to bullet points. Removes filler, preserves names, dates, and code references.</p>
          </div>
        </div>
        <div class="mode-footer">
          <span class="best-with">Best with <strong>SmolLM3 3B</strong></span>
        </div>
      </div>
      <div class="mode-card glass">
        <div class="mode-top">
          <div class="mode-icon">💬</div>
          <div class="mode-info">
            <h3>Message</h3>
            <p>Cleans up into conversational prose. Fixes grammar, keeps your tone and intent intact.</p>
          </div>
        </div>
        <div class="mode-footer">
          <span class="best-with">Best with <strong>SmolLM3 3B</strong></span>
        </div>
      </div>
      <div class="mode-card glass">
        <div class="mode-top">
          <div class="mode-icon">🤖</div>
          <div class="mode-info">
            <h3>Agent</h3>
            <p>Terse, precise instructions for AI coding agents. Extracts intent, preserves identifiers and code references.</p>
          </div>
        </div>
        <div class="mode-footer">
          <span class="best-with">Best with <strong>Qwen3 4B</strong></span>
        </div>
      </div>
      <div class="mode-card glass">
        <div class="mode-top">
          <div class="mode-icon">🛠</div>
          <div class="mode-info">
            <h3>Dev Note</h3>
            <p>Preserves code identifiers, uses bullets and numbered steps. Flags bugs and gotchas automatically.</p>
          </div>
        </div>
        <div class="mode-footer">
          <span class="best-with">Best with <strong>Qwen3 4B</strong></span>
        </div>
      </div>
    </div>
    <!-- Custom mode CTA -->
    <div class="custom-mode-cta reveal glass">
      <div class="custom-mode-text">
        <h3>None of these fit?</h3>
        <p>Open Preferences and build your own mode with a custom system prompt. Name it, tune it, use it from the menubar.</p>
      </div>
      <div class="custom-mode-icon">✏️</div>
    </div>
  </div>
</section>
```

**Step 2: Add CSS**

```css
/* Models */
.model-cards {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 20px; margin-bottom: 80px;
}
.model-card { padding: 28px 24px; position: relative; }
.model-card-featured {
  border-color: var(--accent-glow);
  box-shadow: 0 0 40px rgba(167,139,250,0.1), var(--shadow);
}
.model-badge {
  position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
  background: var(--accent); color: #0d0d0f;
  padding: 3px 14px; border-radius: 12px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase; white-space: nowrap;
}
.model-name { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.model-speed { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
.speed-fast { color: #30d158; }
.speed-balanced { color: var(--accent); }
.speed-capable { color: #ffd60a; }
.model-size { font-size: 12px; color: var(--text-tertiary); margin-bottom: 16px; }
.model-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.5; }

/* Modes */
.modes-header { margin-top: 60px; margin-bottom: 40px; }
.modes-subhead { font-size: 16px; color: var(--text-secondary); max-width: 520px; }
.mode-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
.mode-card { padding: 24px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px; }
.mode-top { display: flex; gap: 16px; align-items: flex-start; }
.mode-icon { font-size: 28px; flex-shrink: 0; margin-top: 2px; }
.mode-info h3 { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.mode-info p { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
.mode-footer { border-top: 1px solid var(--border); padding-top: 12px; }
.best-with { font-size: 12px; color: var(--text-tertiary); }
.best-with strong { color: var(--accent); font-weight: 500; }

/* Custom mode CTA */
.custom-mode-cta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 28px 32px; margin-top: 8px;
  border-color: var(--border-hover);
}
.custom-mode-cta h3 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
.custom-mode-cta p { font-size: 14px; color: var(--text-secondary); max-width: 500px; }
.custom-mode-icon { font-size: 48px; flex-shrink: 0; opacity: 0.7; }

@media (max-width: 768px) {
  .model-cards { grid-template-columns: 1fr; }
  .mode-cards { grid-template-columns: 1fr; }
}
```

**Step 3: Verify** — models grid with recommended badge, 4 mode cards with "best with" tags, custom mode CTA.

**Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add models and modes section"
```

---

### Task 7: Privacy statement section

**Files:**
- Modify: `index.html`

**Step 1: Add HTML after models-modes section**

```html
<section class="section privacy">
  <div class="container">
    <div class="privacy-inner reveal glass">
      <div class="privacy-lock">🔐</div>
      <div class="privacy-statement">No account. No API key. No internet.</div>
      <p class="privacy-detail">
        Blurt uses Whisper.cpp for transcription and Llama.cpp for summarisation — both compiled with Metal GPU support and running entirely on your Mac. Your voice recordings are processed in memory and written only to a temporary file on your local disk, deleted immediately after transcription. Nothing is sent anywhere.
      </p>
      <div class="privacy-pills">
        <span class="pill">On-device Whisper</span>
        <span class="pill">On-device LLM</span>
        <span class="pill">Metal GPU</span>
        <span class="pill">Zero telemetry</span>
        <span class="pill">No account required</span>
      </div>
    </div>
  </div>
</section>
```

**Step 2: Add CSS**

```css
.privacy-inner {
  text-align: center;
  padding: 64px 48px;
  border-color: rgba(167,139,250,0.2);
}
.privacy-lock { font-size: 48px; margin-bottom: 20px; }
.privacy-statement {
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 700; letter-spacing: -0.02em;
  margin-bottom: 24px;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.privacy-detail {
  font-size: 16px; color: var(--text-secondary);
  max-width: 620px; margin: 0 auto 32px;
  line-height: 1.7;
}
.privacy-pills { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.pill {
  background: var(--accent-dim); color: var(--accent);
  border: 1px solid var(--accent-glow);
  padding: 6px 16px; border-radius: 20px;
  font-size: 13px; font-weight: 500;
}
```

**Step 3: Verify** — centered privacy section with gradient headline, pill badges.

**Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add privacy statement section"
```

---

### Task 8: Download CTA + Footer

**Files:**
- Modify: `index.html`

**Step 1: Add HTML after privacy section**

```html
<section class="section download-cta">
  <div class="container">
    <div class="download-inner reveal">
      <h2 class="download-title">Ready to speak your mind?</h2>
      <p class="download-sub">Free. No setup. Just download, grant mic access, and start talking.</p>
      <a href="#" class="btn-primary btn-large">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v10M5 9l4 4 4-4M2 16h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download Blurt
      </a>
      <div class="download-meta">macOS 13 Ventura or later · Apple Silicon (arm64) · v0.1.0</div>
    </div>
  </div>
</section>

<footer class="footer">
  <div class="container footer-inner">
    <div class="footer-logo">
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="7" fill="var(--accent)"/>
        <path d="M8 14 Q14 8 20 14 Q14 20 8 14Z" fill="white" opacity="0.9"/>
      </svg>
      <span>Blurt</span>
    </div>
    <div class="footer-note">Built for Mac. Runs offline. Always.</div>
  </div>
</footer>
```

**Step 2: Add CSS**

```css
.download-cta { padding: 80px 0 100px; }
.download-inner { text-align: center; }
.download-title {
  font-size: clamp(32px, 5vw, 52px); font-weight: 700;
  letter-spacing: -0.03em; margin-bottom: 16px;
}
.download-sub {
  font-size: 18px; color: var(--text-secondary);
  margin-bottom: 40px; max-width: 400px; margin-left: auto; margin-right: auto;
}
.btn-large { padding: 16px 36px; font-size: 17px; }
.download-meta { margin-top: 20px; font-size: 13px; color: var(--text-tertiary); }
.footer {
  border-top: 1px solid var(--border);
  padding: 32px 0;
}
.footer-inner {
  display: flex; align-items: center; justify-content: space-between;
}
.footer-logo { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
.footer-note { font-size: 13px; color: var(--text-tertiary); }
```

**Step 3: Verify** — download section with button, footer with logo.

**Step 4: Final full-page review** — scroll through entire page, check all sections render, animations fire, responsive at 375px mobile width.

**Step 5: Commit**
```bash
git add index.html
git commit -m "feat: add download CTA and footer, complete marketing page"
```

---

## Completion Checklist

- [ ] All sections present: nav, hero, how-it-works, features, models+modes, privacy, download CTA, footer
- [ ] Hero waveform animates, token streaming loops
- [ ] Scroll reveal fires on all `.reveal` elements
- [ ] Glass cards render with backdrop-filter blur
- [ ] Responsive at 375px, 768px, 1100px
- [ ] No console errors
- [ ] All features mentioned exist in the codebase (no fabricated features)
