# Blurt Architecture

## Shared Interfaces

### `Mode` (`src/main/modes.ts`)

```typescript
export interface Mode {
  id: string
  name: string
  prompt: string
  hotkey: string | null
  examples?: Array<{ input: string; output: string }>
}
```

`examples` are injected into the LLM prompt via `buildUserMessage()` in `summarizer.ts`. They are verbatim input/output pairs shown in the "EXAMPLES OF CORRECT BEHAVIOR" block.

## Prompt Assembly (`src/main/summarizer.ts`)

Every LLM call uses a system/user split:

- **System slot:** Minimal generic instruction ("You are a text reformatting function...")
- **User slot:** Assembled by `buildUserMessage()` — INSTRUCTIONS / language declaration / EXAMPLES / SYSTEM CONTEXT (time, tz, locale) / USER MESSAGE

This approach follows SuperWhisper's prompt structure. Fine-tuned models respond better to instructions in the user turn.

## Decisions

### A1 (2026-03-05): SW prompt structure adopted
- Replaced four basic Blurt prompts with SuperWhisper's verbatim prompts
- Added two new modes: Email and Meeting (verbatim SW)
- Agent and Dev Note use SW structural technique applied to Blurt-specific content
- Removed `/no_think` prefix from chatml system slot (was Qwen-specific, not in SW approach)
- `summarize()` now accepts `Mode` (not a raw prompt string) to enable examples injection
- `language` parameter in `buildUserMessage()` defaults to `'English'`; Mode has no language field yet — wiring point is `formatPrompt()` in `summarizer.ts` when a future task adds language to Mode
