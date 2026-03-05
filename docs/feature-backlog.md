# Blurt Feature Backlog
*Each item is sized for a single superpowers planning + implementation session.*
*Reference paths point to detailed docs in `docs/superwhisper_reverse_engineered/`.*

---

## How to use this list

Each feature is a self-contained session. Start a new Claude Code session, invoke `superpowers:writing-plans`, and hand it the feature title + the referenced doc section. Sessions are independent — several can run in parallel since they touch different files.

Files most sessions will need to read first:
- `src/main/pipeline.ts` — the core recording→transcribe→summarize→paste flow
- `src/main/modes.ts` — mode definitions and schema
- `src/main/summarizer.ts` — LLM invocation
- `src/main/transcriber.ts` — Whisper invocation
- `src/main/typer.ts` — paste mechanism
- `src/overlay/overlay.js` + `src/overlay/overlay.css` — the result UI

---

## Group A — Prompts & LLM Quality
*Touches: `modes.ts`, `summarizer.ts`. No UI changes. Safe to run in parallel with Groups B and C.*

### A1 · Replace all mode prompts with SuperWhisper prompts
Replace the `DEFAULT_MODES` array in `modes.ts` with SuperWhisper's verbatim prompts and add the `examples` field to the `Mode` interface. Also update `summarizer.ts` to assemble the full SW-style prompt (INSTRUCTIONS / language declaration / EXAMPLES OF CORRECT BEHAVIOR / SYSTEM CONTEXT / USER MESSAGE) and use the minimal terse system message in the chat template system slot.

**Details:** `docs/superwhisper_reverse_engineered/prompt-improvements.md` — entire file. All five mode prompts (Message, Quick Note, Email, Meeting, Agent, Dev Note), the `buildSystemPrompt()` / `buildUserMessage()` functions, the `examples` schema addition, and the output preamble stripper.

**Files changed:** `src/main/modes.ts`, `src/main/summarizer.ts`

---

### A2 · Lower LLM temperature + add output preamble stripper
Change `--temp 0.7` → `--temp 0.1` in `summarizer.ts` (reformatting tasks are deterministic, not creative). Add the `stripPreamble()` function and apply it to `fullText` in `pipeline.ts` before clipboard write and paste.

**Details:** `docs/superwhisper_reverse_engineered/offline-quality-improvements.md` §6, `docs/superwhisper_reverse_engineered/prompt-improvements.md` §"Output Stripping"

**Files changed:** `src/main/summarizer.ts`, `src/main/pipeline.ts`

---

## Group B — Transcription Quality
*Touches: `transcriber.ts`, audio pre-processing. No UI changes. Safe to run in parallel with Groups A and C.*

### B1 · Whisper quality flags
Add `--no-speech-thr 0.6`, `--logprob-thr -1.0`, `--compression-ratio-thr 2.4`, `--temperature 0`, `--temperature-inc 0.2`, `--beam-size 3`, `--language en` to the whisper-cli args in `transcriber.ts`. Add a `stripHallucinations()` post-processor to strip Whisper's common boilerplate hallucinations before the transcript reaches the LLM.

**Details:** `docs/superwhisper_reverse_engineered/offline-quality-improvements.md` §2, §5, §8

**Files changed:** `src/main/transcriber.ts`

---

### B2 · Audio normalization before Whisper
Before calling whisper-cli, run an ffmpeg pass that normalizes loudness to -16 LUFS and ensures 16kHz mono. Use `ffmpeg-static` (already available in Electron builds) to avoid a new binary dependency.

**Details:** `docs/superwhisper_reverse_engineered/offline-quality-improvements.md` §4

**Files changed:** `src/main/transcriber.ts` (add normalization step before whisper invocation)

---

### B3 · VAD silence stripping before Whisper
Strip silence from the WAV before passing to Whisper. Start with the FFmpeg `silenceremove` filter (no new deps). This is the highest-impact transcription quality improvement — Whisper hallucinates heavily on silence.

**Details:** `docs/superwhisper_reverse_engineered/offline-quality-improvements.md` §1 (use Option B — FFmpeg, not the ONNX approach)

**Files changed:** `src/main/transcriber.ts` (add VAD pre-processing step)

*Note: B2 and B3 both add ffmpeg pre-processing steps before whisper. Run B2 first or combine into one session.*

---

### B4 · Per-mode vocabulary → Whisper initial prompt
Add a `vocabulary?: string[]` field to the `Mode` interface. When a mode has vocabulary defined, pass it as `--prompt "word1, word2, word3"` to whisper-cli. This dramatically improves accuracy for technical terms and proper nouns. Update the preferences UI to allow editing vocabulary per mode.

**Details:** `docs/superwhisper_reverse_engineered/offline-quality-improvements.md` §3, `docs/superwhisper_reverse_engineered/superwhisper-architecture-analysis.md` §"Vocabulary System"

**Files changed:** `src/main/modes.ts`, `src/main/transcriber.ts`, `src/main/pipeline.ts` (pass mode to transcriber), `src/preferences/prefs.js` + `prefs.css`

---

### B5 · Multiple Whisper model sizes + per-mode model selection
Currently Blurt hardcodes `ggml-base.en.bin`. Add a whisper model catalog (tiny.en, base.en, small.en, medium.en) with download support. Add a `whisperModel` field to Mode so fast modes use tiny.en and quality modes (Meeting) use medium.en. Expose in preferences.

**Details:** `docs/superwhisper_reverse_engineered/superwhisper-architecture-analysis.md` §"Models (offline)", `docs/superwhisper_reverse_engineered/offline-quality-improvements.md` §7

**Files changed:** `src/main/transcriber.ts`, `src/main/modes.ts`, `src/main/model-catalog.ts` (add whisper catalog alongside LLM catalog), `src/main/setup.ts`, preferences UI

---

## Group C — Overlay UI
*Touches: `overlay.js`, `overlay.css`, `overlay-window.ts`. Safe to run in parallel with Groups A and B.*

### C1 · Wave-reveal streaming animation + shimmer finalization
Replace the current token-append approach with SuperWhisper's two-phase render: (1) stream tokens as per-character wave-reveal spans with staggered animation-delay; (2) on completion, apply a shimmer CSS state for 600ms, then replace with `marked.parse()` Markdown HTML and scroll to top. Also add the blinking waiting cursor (shown during STT processing) and correct scroll direction (bottom during streaming, top on finalized).

**Details:** `docs/superwhisper_reverse_engineered/streaming-ui-analysis.md` — §"The Four UI States", §"What Blurt Should Steal" (all five subsections), full CSS from §"The Full HTML Template"

**Files changed:** `src/overlay/overlay.js`, `src/overlay/overlay.css`

---

## Group D — Paste & Clipboard
*Touches: `typer.ts`, `pipeline.ts`. Isolated changes.*

### D1 · Clipboard restore after paste
Before pasting, save the current clipboard contents. After the paste completes (1.2s delay), restore the previous clipboard. This stops every dictation from nuking the user's clipboard.

**Details:** Conversation analysis — "Clipboard restore" section

**Files changed:** `src/main/pipeline.ts` (save/restore around the paste call), optionally expose restore delay as a setting in `src/main/settings.ts`

---

### D2 · Push-to-talk (hold-to-record) mode
Add a hold-to-record option alongside the current toggle mode. When enabled, the hotkey starts recording on keydown and stops on keyup. For short commands this is dramatically faster — no stop button needed.

**Details:** Conversation analysis — "Push-to-talk" feature discussion. Implementation: `src/main/hotkey.ts` needs to handle keydown vs keyup events; `src/main/settings.ts` needs a `hotkeyMode: 'toggle' | 'hold'` field.

**Files changed:** `src/main/hotkey.ts`, `src/main/settings.ts`, preferences UI

---

## Group E — History
*New file: `src/main/history.ts`. Touches `pipeline.ts`. Isolated.*

### E1 · SQLite recording history
After each successful pipeline run, persist a record to a SQLite database (`~/.config/blurt/history.db`) via `better-sqlite3`. Schema: `id`, `datetime`, `duration_ms`, `raw_transcript`, `llm_result`, `mode_id`, `whisper_model`, `llm_model`, `target_app`. Expose the last 20 results in the tray menu as clickable items that copy to clipboard.

**Details:** Conversation analysis — "SQLite history — what does it actually unlock?" section. `docs/superwhisper_reverse_engineered/superwhisper-architecture-analysis.md` §"Recording History (SQLite via GRDB)"

**Files changed:** `src/main/history.ts` (new), `src/main/pipeline.ts` (call history.save() on completion), `src/main/tray.ts` (add History submenu)

---

### E2 · Re-process last recording
Add a tray menu item "Re-process last recording…" that opens a mode picker and re-runs the LLM on the last raw transcript — no re-speaking needed. Requires E1 (history) to be done first.

**Details:** Conversation analysis — "Re-process" under SQLite history features

**Files changed:** `src/main/tray.ts`, `src/main/pipeline.ts` (extract reprocess path), `src/main/history.ts`

**Depends on:** E1

---

## Group F — App Context
*Touches: `pipeline.ts`, `summarizer.ts`, `typer.ts`. Isolated.*

### F1 · App context injection (name + format hint)
On recording start, capture the frontmost app name (already done in `typer.ts`). Look it up in a bundled app catalog (20-30 common apps: Slack, VSCode, Notion, Cursor, Mail, Messages, Chrome, Terminal, etc.) to get a `text_input_format` value. Inject a one-line hint into the LLM prompt: `"The user is typing into {App} ({category}). Format output as {text_input_format}."` Add the catalog as a static JSON file.

**Details:** `docs/superwhisper_reverse_engineered/superwhisper-architecture-analysis.md` §"Context Injection", conversation analysis §"App context — worth it?"

**Files changed:** `src/main/pipeline.ts`, `src/main/summarizer.ts`, new `src/main/app-catalog.ts` + `assets/app-catalog.json`

---

### F2 · Auto-activate mode by frontmost app
Add an `activationApps?: string[]` field to the Mode schema. When starting a recording, if the frontmost app matches any mode's `activationApps` list, that mode activates automatically (overriding the manually selected mode). Useful defaults: Mail.app → Email mode, calendar apps → Meeting mode.

**Details:** `docs/superwhisper_reverse_engineered/superwhisper-architecture-analysis.md` §"Mode System"

**Files changed:** `src/main/modes.ts`, `src/main/pipeline.ts`, preferences UI

**Depends on:** F1 (reuses the frontmost app capture)

---

## Group G — Power User Features
*Each is self-contained.*

### G1 · Per-mode hotkeys (bind modes to ⌘1–9 or custom shortcuts)
Add a `hotkey` field per mode (already in the schema but not wired up). When a mode-specific hotkey is pressed, activate that mode and start recording immediately. Show the active mode's name in the tray icon tooltip.

**Details:** `docs/superwhisper_reverse_engineered/superwhisper-architecture-analysis.md` §"Mode System" (hotkey field), current `src/main/hotkey.ts` + `src/main/tray.ts`

**Files changed:** `src/main/hotkey.ts`, `src/main/tray.ts`, preferences UI

---

### G2 · "Fix that" — immediate correction flow
Add a second hotkey (default `⌃⌥X`) that re-opens the overlay pre-populated with the last result. The user dictates a correction. The LLM receives: `"Original: {last_result}\nCorrection instruction: {dictated_fix}\nApply the correction and return only the corrected text."` The corrected result replaces what was previously typed (if the target app is still focused) or goes to clipboard.

**Details:** Conversation analysis — "Fix that / immediate correction" feature. Requires E1 or at minimum in-memory storage of the last result.

**Files changed:** `src/main/hotkey.ts`, `src/main/pipeline.ts`, `src/main/tray.ts`, `src/overlay/overlay.js`

---

### G3 · Clipboard-as-input mode ("Do something with this")
Add a new built-in mode called "Transform" (or allow any mode to be flagged `clipboardAsInput: true`). When active: the clipboard content is the primary input (not the transcript). The user's dictation becomes the instruction. LLM receives: `"Text: {clipboard}\nInstruction: {transcript}\n"`. The result replaces the clipboard and optionally pastes.

**Details:** Conversation analysis — "Clipboard-as-input mode" feature. `docs/superwhisper_reverse_engineered/superwhisper-architecture-analysis.md` §"`contextTemplate` for clipboard/selection context"

**Files changed:** `src/main/modes.ts`, `src/main/pipeline.ts`, `src/main/summarizer.ts`

---

## Suggested parallelism

These groups have no shared file dependencies and can run simultaneously:

```
Session 1: A1 (prompts)
Session 2: A2 (temperature + preamble strip)
Session 3: B1 + B2 + B3 (whisper flags + normalization + VAD — combine these, they all touch transcriber.ts)
Session 4: C1 (overlay animation)
Session 5: D1 (clipboard restore)
```

After those complete:
```
Session 6: B4 (vocabulary — depends on A1 for Mode schema)
Session 7: B5 (whisper model selection)
Session 8: E1 (history)
Session 9: D2 (push-to-talk)
Session 10: F1 (app context)
```

After E1:
```
Session 11: E2 (re-process)
Session 12: G1 (per-mode hotkeys)
Session 13: G2 (fix that)
Session 14: G3 (clipboard-as-input)
Session 15: F2 (auto-mode by app — depends on F1)
```
