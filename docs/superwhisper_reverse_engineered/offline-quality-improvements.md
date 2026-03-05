# Offline Quality Improvements
*Prioritized list of technical improvements to match SuperWhisper's offline quality*

---

## 1. VAD Silence Stripping (Highest Impact)

**Why**: Whisper hallucinates on silence. Pauses, breath sounds, and low-energy audio sections produce phantom text, repeated words, or gibberish. This is the #1 source of transcript errors.

**What SuperWhisper does**: Runs Silero VAD (an ONNX model) to detect speech segments, strips non-speech sections, then passes only speech audio to Whisper.

**How to implement in Blurt**:

Option A — `@ricky0123/vad-node` (JavaScript, Silero VAD):
```bash
npm install @ricky0123/vad-node onnxruntime-node
```
```typescript
import { MicVAD } from '@ricky0123/vad-node'
// Or for file-based processing, use the lower-level API to process a WAV file
// and return only speech segments
```

Option B — FFmpeg silence detection (no ML, simpler):
```bash
ffmpeg -i input.wav -af silenceremove=start_periods=1:start_silence=0.3:start_threshold=-50dB:stop_periods=-1:stop_duration=0.3:stop_threshold=-50dB output.wav
```
This is a heuristic (energy threshold), less accurate than Silero VAD but zero dependencies.

Option C — Pass `--vad-threshold` to a VAD-enabled whisper build. The whisper.cpp binary already includes Silero VAD support; it just needs to be enabled.

**Recommended**: Start with Option B (FFmpeg is already bundled in Electron apps via ffmpeg-static). Upgrade to Option A if you want Silero's accuracy.

---

## 2. Whisper Flags for Quality

Current Blurt whisper.cpp call is missing several quality flags. Add these:

```typescript
const args = [
  '-m', modelPath,
  '-f', wavPath,
  '--output-txt',
  // Add these:
  '--no-speech-thr', '0.6',      // suppress segments where Whisper is unsure there's speech
  '--logprob-thr', '-1.0',       // suppress low-confidence segments
  '--compression-ratio-thr', '2.4', // suppress hallucination loops (repeated text)
  '--best-of', '5',              // use 5 candidates, pick best (accuracy vs speed tradeoff)
  '--beam-size', '5',            // beam search (slower but more accurate than greedy)
  '--word-tsp',                  // enable word timestamps (useful for future features)
  '--language', 'en',            // explicit language avoids language detection overhead
  '-t', '4',                     // thread count (tune to machine)
]
```

**Tradeoff**: `--beam-size 5` and `--best-of 5` significantly improve accuracy but increase latency by ~2-3x vs greedy. For a dictation app where the user is waiting, `--beam-size 3` is a good middle ground.

For speed-critical paths, stick with greedy (default) but add the threshold flags — those are free.

---

## 3. Custom Vocabulary → Whisper Initial Prompt

Whisper's decoder uses the previous context to bias predictions. Passing an initial prompt of domain-specific words, names, and technical terms significantly improves their transcription.

**Add to Mode schema:**
```typescript
interface Mode {
  // ... existing fields
  vocabulary?: string[]  // custom words/names for this mode
}
```

**Pass to whisper.cpp:**
```typescript
if (mode.vocabulary && mode.vocabulary.length > 0) {
  args.push('--prompt', mode.vocabulary.join(', '))
}
```

**Example vocabulary for a dev mode**: `["TypeScript", "React", "Postgres", "Tailwind", "Next.js", "useState", "useEffect", "async", "await"]`

The effect is dramatic for technical terms and proper nouns that Whisper consistently mishears (e.g., "Kubernetes" → "Cube Nettie", "Svelte" → "svelte", "Zustand" → "zoo stand").

---

## 4. Audio Normalization

Whisper expects audio at a consistent loudness level. Quiet recordings (far from mic, soft speaker) have significantly worse accuracy.

**Add before transcription:**
```bash
ffmpeg -i input.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 16000 -ac 1 normalized.wav
```

The `-af loudnorm` filter applies EBU R128 normalization. `-ar 16000 -ac 1` ensures 16kHz mono (Whisper's expected format).

This is especially important for:
- Headset vs. built-in mic differences
- Varying recording distances
- Noisy environments

---

## 5. Temperature Fallback

Whisper supports temperature fallback: try greedy (temp=0), and if the result has poor confidence metrics, retry with higher temperature. whisper.cpp implements this natively.

```typescript
args.push(
  '--temperature', '0',
  '--temperature-inc', '0.2',  // increment when retrying
  // --best-of applies at each temperature level
)
```

SuperWhisper's binary shows `"Decoding with temperatures"` (plural) — they use this fallback strategy.

---

## 6. LLM: Temperature Setting

Current Blurt uses `--temp 0.7` for the LLM. For text cleanup tasks (not creative generation), lower temperature produces more consistent, deterministic output.

**Recommendation**: Use `--temp 0.0` to `--temp 0.2` for cleanup/notes/message modes. The task is deterministic reformatting, not creative generation. Low temperature = fewer surprises.

SuperWhisper uses cloud APIs where it can set temperature via the API. For local llama.cpp, `--temp 0.1` is a good default for reformatting tasks.

---

## 7. Model Selection for Offline Quality

SuperWhisper's included local LLM choices vs. Blurt's current catalog:

| Model | Params | SuperWhisper | Blurt | Quality |
|-------|--------|-------------|-------|---------|
| Phi-2 | 2.7B | ✓ | ✗ | Good for English |
| Mistral 7B v0.2 | 7B | ✓ | ✗ | Best in SW lineup |
| Llama 3.2 3B | 3B | ✓ | via 1B | Good |
| **SmolLM3 3B** | 3B | ✗ | ✓ | **Better than Mistral for this task** |
| **Qwen3 4B** | 4B | ✗ | ✓ | **Best in Blurt lineup** |

Blurt's model choices are newer and arguably better suited to the task. The Q4_K_M quantization is the right choice (good accuracy/size tradeoff).

**One addition to consider**: `Qwen3-1.7B-Q4_K_M` (~1.1GB) as an ultra-fast option for users who want near-instant results and don't need meeting summarization quality.

---

## 8. Hallucination Post-Processing

After getting the Whisper transcript, run a simple post-process to catch common hallucinations before sending to the LLM:

```typescript
const COMMON_WHISPER_HALLUCINATIONS = [
  /^(Thanks for watching|Thank you for watching)[.!]?$/i,
  /^Subtitles by .+$/i,
  /^(Subscribe|Like and subscribe)[.!]?$/i,
  /^\[Music\]$/i,
  /^\[Applause\]$/i,
  /^(www\.|http:\/\/)/i,
]

function stripHallucinations(transcript: string): string {
  return transcript
    .split('\n')
    .filter(line => !COMMON_WHISPER_HALLUCINATIONS.some(r => r.test(line.trim())))
    .join('\n')
    .trim()
}
```

This catches the most common patterns where Whisper inserts boilerplate YouTube/video captions.

---

## Summary: Effort vs. Impact

| Improvement | Effort | Impact | Priority |
|-------------|--------|--------|----------|
| VAD silence stripping | Medium | Very High | 1 |
| Prompt anti-bloat (`CRITICAL INSTRUCTION`) | Low | High | 2 |
| Whisper quality flags (thresholds) | Low | Medium-High | 3 |
| LLM temperature → 0.1 | Trivial | Medium | 4 |
| Vocabulary → Whisper prompt | Low | High (domain-specific) | 5 |
| Audio normalization | Low | Medium | 6 |
| Few-shot examples per mode | Medium | High (small models) | 7 |
| Hallucination stripping | Low | Low-Medium | 8 |
| Preamble stripping (LLM output) | Low | Medium | 9 |
| Beam search (whisper) | Trivial | Medium | 10 |
