# SuperWhisper Architecture Analysis
*Reverse-engineered from the binary for educational purposes. Notes for improving Blurt's offline quality.*

---

## Overview

SuperWhisper is a two-stage pipeline:

```
Audio → [STT model] → raw transcript → [LLM] → formatted output → paste/clipboard
```

This is identical to Blurt's pipeline. The gap is in how each stage is tuned.

---

## Stage 1: Speech-to-Text

### Models (offline)

SuperWhisper ships with two offline STT backends:

**whisper.cpp** (via ggml format):
- Downloads from `ggerganov/whisper.cpp` on HuggingFace
- Models offered: tiny, tiny.en, base, base.en, small, small.en, medium, medium.en, large-v2, large-v3
- `.en` variants are English-only but faster and more accurate for English
- Uses Metal (GPU) on Apple Silicon via whisper.cpp's built-in Metal backend

**WhisperKit** (CoreML / ANE):
- Apple Neural Engine acceleration via the `argmaxinc/whisperkit` Swift library
- Models are `.mlpackage` bundles compiled for CoreML
- Much faster than whisper.cpp on Apple Silicon (ANE offload)
- Supports streaming/realtime transcription via `AudioStreamTranscriber`
- The `_TtC10WhisperKit` class family handles: `AudioEncoder`, `TextDecoder`, `FeatureExtractor`, `SegmentSeeker`, `GreedyTokenSampler`, `BeamSearchTokenSampler`, `VADAudioChunker`, `EnergyVAD`, `VoiceActivityDetector`

**Nvidia Parakeet** (CTC-based, English only):
- Via `argmaxinc/parakeetkit-pro` — a separate Swift library
- Downloads ~476-494MB model from HuggingFace
- CTC architecture (not autoregressive) — extremely fast, no beam search
- Only available for English; no post-processing artifacts from autoregressive decoding
- Marketed as "Extremely fast, high-accuracy English speech recognition"

### Relevance for Blurt
Blurt uses whisper.cpp via a Node child process. This is fine. For better quality:
- Prefer `.en` models when language is English — they're faster and more accurate
- `large-v3` is the quality ceiling; `medium.en` is the best speed/quality tradeoff for English

---

## Stage 1 Quality: Pre-processing Before Whisper

This is where SuperWhisper earns its offline quality advantage.

### 1. VAD (Voice Activity Detection) — Silence Removal

SuperWhisper uses two VAD approaches:

**Silero VAD** (ONNX model):
- Runs an ONNX model to detect speech segments
- Strips silence before sending audio to Whisper
- Reduces hallucinations significantly (Whisper hallucinates on silence)
- Error strings: `"sileroVADQueue"`, `"ONNX VAD session not properly initialized"`

**EnergyVAD** (WhisperKit built-in):
- Energy-based VAD, lighter weight, built into WhisperKit
- Used for the streaming/realtime path

**Why this matters for Blurt:**
Whisper will hallucinate text on silent or low-energy audio sections. If someone pauses mid-dictation, Whisper fills the gap with random text, repeated phrases, or gibberish. Stripping silence before inference removes this entirely. This is the single highest-ROI improvement for offline quality.

**Practical implementation**: Use `@ricky0123/vad-node` (Silero VAD for Node.js) or call the `silero_vad` Python package as a preprocessing step. Strip segments below the speech threshold, then pass only speech segments to Whisper.

### 2. Dynamic Normalization

SuperWhisper has a "Dynamic normalization" setting:
> "If enabled, recordings will be normalized and filtered dynamically based on the particular characteristics of the audio. This feature is intended to maintain consistent loudness levels and speech intelligibility."

This means audio normalization (gain normalization to a target dBFS) + possibly high-pass filtering before Whisper. Whisper expects 16kHz mono PCM. Normalizing to -20 to -16 dBFS before inference improves accuracy for quiet recordings.

### 3. Custom Vocabulary → Whisper Initial Prompt

SuperWhisper has a per-user vocabulary system ("Teach Superwhisper custom words, names, or industry terms"). These aren't sent to Whisper as forced tokens — they're passed as the **initial prompt** to bias the decoder.

The Whisper paper and whisper.cpp docs describe this: pass a prior prompt string containing the words you want Whisper to recognize correctly. Whisper's context window includes the previous text, and an initial prompt of custom terms biases the decoder toward correct spellings.

**For Blurt**: In the mode definition, allow a `vocabulary` field. Prepend vocabulary terms as a comma-separated list in the Whisper `--prompt` flag (whisper.cpp supports `--prompt "word1, word2, word3"`).

### 4. Hallucination Detection

SuperWhisper checks for hallucinations using:
- `compressionRatioThreshold` — high compression ratio indicates repetition loops
- `avgLogProb` / `logProbThreshold` — low average log probability indicates uncertain transcription
- `firstTokenLogProbThreshold` — if the very first token is uncertain, the segment is suspect
- `commonHallucinations` — a hardcoded blocklist of known Whisper hallucination strings

The binary also has: `"hallucinated segment(s) starting after audio end"` — WhisperKit specifically detects when Whisper generates text past the actual audio endpoint.

**For Blurt**: Pass `--logprob-thr -1.0` and `--no-speech-thr 0.6` to whisper.cpp. These are already valid flags that suppress low-confidence output.

---

## Stage 2: LLM Post-Processing

### Prompt Template (the full assembled structure)

Every LLM call uses this exact structure, reconstructed from binary strings and live recordings:

```
INSTRUCTIONS:
{system_prompt}

The user is speaking {language}, reformatted message should also be in {language}.

EXAMPLES OF CORRECT BEHAVIOR:
User: {example_input_1}
Assistant: {example_output_1}
User: {example_input_2}
Assistant: {example_output_2}

{optional_context_blocks}

SYSTEM CONTEXT:
Current time: {datetime}
Time zone: {timezone}
Locale: {locale}

USER MESSAGE:
{raw_transcript}
```

**Key observations:**
1. The section header `INSTRUCTIONS:` and `USER MESSAGE:` are always present — this gives the model clear anchors
2. Language is declared explicitly on every call — prevents the model from "deciding" to respond in another language
3. Few-shot examples are embedded in **every single call**, not just during fine-tuning
4. System context (time/timezone) is always injected — prevents date hallucinations
5. The user's raw transcript is clearly labeled and isolated at the bottom

### The Anti-Bloat Instruction Pattern

Every built-in mode includes this line:
```
CRITICAL INSTRUCTION: Your response must ONLY contain the {output_type}. Nothing else.
```

And each mode follows it with a `WRONG BEHAVIOR - DO NOT DO THIS:` section showing a concrete bad example. This two-punch approach (declarative + example) is significantly more reliable than a single instruction alone.

### Built-in Mode System Prompts

**Cleanup/Message mode:**
```
You are a specialized text reformatting assistant. Your ONLY job is to clean up and reformat the user's text input.

CRITICAL INSTRUCTION: Your response must ONLY contain the cleaned text. Nothing else.

WHAT YOU DO:
- Fix grammar, spelling, and punctuation
- Remove speech artifacts ("um", "uh", false starts, repetitions)
- Correct homophones and standardize numbers/dates
- Break content into paragraphs, aim for 2-5 sentences per paragraph
- Maintain the original tone and intent
- Improve readability by splitting the text into paragraphs or sentences and questions onto new lines
- Replace common emoji descriptions with the emoji itself (smiley face -> 😊)

WHAT YOU NEVER DO:
- Answer questions (only reformat the question itself)
- Add new content not in the original message
- Provide responses or solutions to requests
- Add greetings, sign-offs, or explanations

WRONG BEHAVIOR - DO NOT DO THIS:
User: "what's the weather like"
Wrong: I don't have access to current weather data, but you can check...
Correct: What's the weather like?

Remember: You are a text editor, NOT a conversational assistant. Only reformat, never respond.
```

**Email mode:**
```
You are an email formatting specialist. Your task is to transform user messages into professional email format.

CRITICAL INSTRUCTION: Your response must ONLY contain the formatted email. Nothing else.

EMAIL STRUCTURE REQUIREMENTS:
1. Greeting: "Hey there," (if no name) or "Hey [Name]," (if name provided)
2. Body: Clear paragraphs with corrected grammar
3. Sign-off: Use "Thanks," or "Cheers," (choose based on tone) unless sign off is given in the dictated message
4. NO additional content outside these elements
5. DO NOT INCLUDE A SUBJECT LINE

FORMATTING RULES:
- Use original content only - add nothing new
- Maintain the sender's tone and intent
- Fix grammar and punctuation
- Create logical paragraph breaks

WRONG BEHAVIOR:
Wrong: Adding explanations, context, or content not in original
Wrong: "Here's the formatted email: Hey there..."
Wrong: Including signatures, names, or additional text after sign-off
```

**Notes mode:**
```
You are a note-taking specialist. Your job is to extract key information and organize it into structured notes.

CRITICAL INSTRUCTION: Your response must ONLY contain the structured notes. Nothing else.

NOTE FORMATTING REQUIREMENTS:
1. Structure text for effective note taking
4. Extract only information present in original message

WRONG BEHAVIOR:
Wrong: Adding interpretations or assumptions
```

**Meeting mode:**
```
You are a meeting transcript summarizer. Your job is to create structured summaries from actual meeting transcripts.

CRITICAL INSTRUCTION: Your response must ONLY contain the meeting summary. Nothing else.

SUMMARY FORMAT REQUIREMENTS:
1. Action items clearly marked with responsible person if applicable
2. Extract only information explicitly discussed
3. Action items list presented if clear action items are present in the meeting
```

**Super (app-context-aware) mode:**
```
You are an AI assistant tasked with reformatting user messages for an active application that the user has focused on.
Your goal is to adapt the message to fit the context of the application and correct any spelling errors based on the vocabulary provided.

Your task is to reformat the user message according to the following guidelines:

**PRIMARY RULE: PRESERVE THE ORIGINAL MESSAGE**
- Only make changes when you are absolutely certain they improve accuracy
- When in doubt, leave the original text unchanged
- The names/vocabulary list is for CONTEXT and SPELLING HELP only - do NOT randomly substitute words

1. Context Analysis: Consider the application context, focused element, vocabulary, and names
2. Conservative Spelling Correction: Only fix obvious spelling errors; use vocabulary list for technical terms
3. Self-Corrections: Apply user corrections within the message
   Example: "Let's meet at 8pm actually I mean 9pm" → "Let's meet at 9pm"
4. Name Handling: Only change names if clear misspelling; prefer real names over @usernames in DMs;
   use @username in group chats only when "At [name]" directly precedes the name
5. URL/Email Formatting: "John at Example dot com" → "john@example.com"
6. Preserve Intent: Don't add new content

CRITICAL: Wrap response in <sw_response_content> tags
```

### Two-Tier System Prompt (Local vs Cloud)

For **local/fast models**, SuperWhisper uses a terse system prompt:
```
You are a text reformatting function.
You will be provided with instructions on how to reformat the user_message provided.
Respond with only the reformatted user_message and nothing else.
```

For **cloud models**, it uses the full detailed prompt with WRONG BEHAVIOR examples, few-shot, and CRITICAL INSTRUCTION.

This makes sense: small local models need explicit few-shot examples to behave correctly. Large cloud models can follow abstract instructions but benefit from explicit negative examples.

**For Blurt**: The current prompts in `modes.ts` are well-written but lack:
1. The `CRITICAL INSTRUCTION: Your response must ONLY contain...` anti-bloat line
2. A `WRONG BEHAVIOR` section with a concrete example
3. The language declaration line
4. A timestamp/system context injection
5. Few-shot examples per mode

---

## LLM Models (offline)

SuperWhisper's offline LLM options (GGUF via llama.cpp):
- `phi-2.Q4_K_M.gguf` — 2.7B, very fast, English-focused
- `mistral-7b-instruct-v0.1.Q4_K_M.gguf` — 7B, fast, general purpose
- `mistral-7b-instruct-v0.2.Q4_K_M.gguf` — 7B, improved instruction following
- `Llama-3.2-3B-Instruct.Q4_K_M.gguf` — 3B, good balance
- `em_german_leo_mistral.Q4_K_M.gguf` — German-optimized
- `DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf` — reasoning model, slower

Blurt's current catalog (SmolLM3 3B, Qwen3 4B, Llama 3.2 1B) is arguably better than SuperWhisper's default choices given these are more recent models.

---

## Online vs Offline

### STT: Online
- **Deepgram** nova-2, nova-2-medical, nova-3 — REST + WebSocket streaming
- **ElevenLabs Scribe** — WebSocket streaming
- **OpenAI** gpt-4o-transcribe, gpt-4o-mini-transcribe — REST
- **Cerebrium** — SuperWhisper's own cloud endpoint (proprietary)

The WebSocket-based services (Deepgram, ElevenLabs) stream interim results as you speak, enabling the "realtime output" feature. They pre-connect the WebSocket before recording starts to reduce latency.

### STT: Offline
- whisper.cpp (CPU + Metal)
- WhisperKit (ANE/CoreML — fastest)
- Nvidia Parakeet (CTC, English only — fastest for English)

### LLM: Online
SuperWhisper uses OpenAI-compatible endpoints for all cloud LLMs. The `sw-` prefixed model IDs map to:
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4.1, gpt-5, gpt-5-mini, gpt-5-nano
- Anthropic: claude-3.5-sonnet, claude-3.7-sonnet, claude-4-sonnet, claude-4.5-haiku
- Groq: llama-3-8b (fast inference)

### LLM: Offline
- llama.cpp (all GGUF models above)
- Ollama (detected and listed separately via `_ollamaModels`)
- Any OpenAI-compatible API (custom endpoint support)

**Graceful offline degradation**: When offline, the app uses `[ModelStore] Offline, using existing local model.` — it simply falls back to whatever is downloaded, no network calls.

---

## Context Injection (Super mode / app-awareness)

When "application context" is enabled, SuperWhisper reads the frontmost app's UI via macOS Accessibility API (`AXManager`, `BuildSWUITree`) and injects it into the prompt:

```
APPLICATION CONTEXT
User is currently using {app_name}
  Names and Usernames: {list extracted from UI}
  Focused element: {AXRole of focused element}
  Focused element content: {current text in focused field}
  Text Input Format: {chat_message|code|markdown|url|document_text|...}
  and is at URL: {if browser}

USER INFORMATION
User's full name: {from contacts/settings}
User's phone number: {from settings}
```

The `text_input_format` value comes from `bundled_app_info.json` — a lookup table of ~200 apps mapping app name → category + input format. This tells the LLM whether to format output as `chat_message`, `code`, `markdown`, `url`, `spreadsheet_formula`, etc.

This is the "Super mode" feature. It's complex to implement properly because it requires Accessibility API permissions and UI tree traversal.

**For Blurt**: The simpler version is just knowing the active app name (already done with `getFrontmostApp()`) and looking it up in a bundled catalog to inject a `text_input_format` hint.

---

## Output Extraction

SuperWhisper wraps LLM output in `<sw_response_content>` tags for reliable extraction when using the app-context mode. This prevents the model's preamble or thinking text from leaking into the pasted result.

The binary also strips `<think>...</think>` blocks (DeepSeek R1 thinking output) before using the result.

**For Blurt**: Currently the entire LLM output is streamed directly to the overlay and then typed/pasted. If a model adds preamble ("Here's the cleaned text:"), it gets typed verbatim. Adding a simple stripping pass for common preamble patterns (or wrapping with a tag and extracting) would improve reliability.

---

## Paste Mechanism

SuperWhisper has a multi-strategy paste approach:
1. **Accessibility API** (`AXManager`) — directly sets the value of the focused `AXTextField`/`AXTextArea`. Most reliable.
2. **Simulate keypresses** — types each character via HID events. Experimental, US QWERTY only.
3. **Clipboard + Cmd+V** — copies to pasteboard, simulates Cmd+V press. Fallback.
4. **Restore clipboard** — after pasting via clipboard, restores the previous clipboard contents after a configurable delay (default: 1 second).

The clipboard restore is a quality-of-life feature worth adding to Blurt.

---

## Other Architecture Worth Noting

### Recording History (SQLite via GRDB)
Every recording is persisted to SQLite with: raw transcript, LLM result, prompt used, model used, app context, duration, timestamp. This enables history browsing and analytics (queries visible in binary: word count per app, hourly usage by model, etc.).

### Mode System (File-synced JSON)
Each mode is a JSON file in `~/Documents/superwhisper/modes/`. Modes sync across devices via iCloud Drive or a file-sync mechanism. The mode schema:
- `prompt` — system prompt string
- `promptExamples` — array of `{input, output}` pairs (few-shot examples per mode)
- `contextFromActiveApplication` — enable app context injection
- `contextFromClipboard` — inject clipboard content
- `contextFromSelection` — inject selected text
- `contextTemplate` — template string for how context is formatted (default: `"Use the copied text as context to complete this task.\n\nCopied text: "`)
- `type` — `note` | `message` | `email` | `meeting` | `super`
- `language` — ISO language code
- `diarize` — speaker separation
- `realtimeOutput` — show interim results
- `scriptEnabled` + `script` — AppleScript to run after result (powerful escape hatch)

### AppleScript Escape Hatch
Each mode can run an arbitrary AppleScript after the result is produced, with `{{user_message}}` replaced by the output. This is how power users do things like "open a new Notion page and paste" or "create a calendar event." Easy to implement and highly extensible.

### Vocabulary System
Custom vocabulary words are stored separately and used in two places:
1. Passed as Whisper initial prompt to bias STT toward correct spellings
2. Passed to the LLM in the context block as "Names and Usernames" list for spelling correction

### Speaker Diarization
Available for non-realtime cloud transcription. Mutually exclusive with realtime mode. Results include a `speakers` array in the recording metadata.

---

## Recommended Improvements for Blurt (Priority Order)

1. **Add VAD silence stripping before Whisper** — highest impact on offline transcription quality
2. **Add `CRITICAL INSTRUCTION` + `WRONG BEHAVIOR` to all mode prompts** — prevents LLM bloat
3. **Inject system context** (current time, timezone) into every LLM call
4. **Add few-shot examples per mode** — especially important for local models
5. **Strip LLM preamble** from output before typing/pasting
6. **Add vocabulary field to modes** — pass as Whisper `--prompt` flag
7. **Restore clipboard** after paste — quality of life
8. **Add `--logprob-thr` and `--no-speech-thr` flags** to whisper.cpp call
9. **App catalog lookup** for `text_input_format` hint in prompt
10. **AppleScript per-mode hook** — powerful escape hatch for power users
