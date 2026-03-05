# A1: Replace Mode Prompts with SuperWhisper Prompts — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Blurt's four basic mode prompts with SuperWhisper's verbatim prompts, add two new modes (Email, Meeting), add `examples` to the `Mode` interface, and refactor `summarizer.ts` to assemble the full SW-style system/user split prompt.

**Architecture:** Two-file change. `modes.ts` gets a new `examples` field on `Mode` and six updated `DEFAULT_MODES`. `summarizer.ts` gains `buildSystemPrompt()` and `buildUserMessage()` helpers; `formatPrompt()` is updated to accept a `Mode` instead of a raw string; `summarize()` signature changes accordingly. `pipeline.ts` gets a one-line update to pass the full `Mode` object instead of `activeMode.prompt`.

**Tech Stack:** TypeScript, Vitest (tests run with `yarn test`)

---

## Context

**Key files:**
- `src/main/modes.ts` — `Mode` interface + `DEFAULT_MODES` + load/save helpers
- `src/main/summarizer.ts` — `formatPrompt()` + `summarize()` generator
- `src/main/pipeline.ts` — calls `summarize(rawText, activeMode.prompt)` (needs update)
- `src/main/modes.test.ts` — tests length of DEFAULT_MODES (currently 4, will become 6)
- `src/main/summarizer.test.ts` — calls `summarize(text, 'prompt')` (signature changes)

**Current `summarize` signature:** `summarize(rawText: string, systemPrompt: string)`
**New signature:** `summarize(rawText: string, mode: Mode)`

**Current `formatPrompt`:** takes `(template, systemPrompt, userText)` — combines mode prompt + transcript directly.
**New `formatPrompt`:** takes `(template, mode, transcript)` — calls `buildSystemPrompt()` for system slot, `buildUserMessage()` for user slot.

**Tests run with:** `yarn test`

---

## Task 1: Add `examples` field to `Mode` interface

**Files:**
- Modify: `src/main/modes.ts`

**Step 1: Update the `Mode` interface**

In `src/main/modes.ts`, change lines 5–10:

```typescript
export interface Mode {
  id: string
  name: string
  prompt: string
  hotkey: string | null
  examples?: Array<{ input: string; output: string }>
}
```

**Step 2: Run existing tests to confirm they still pass**

```bash
yarn test
```

Expected: all tests pass (adding an optional field is non-breaking).

**Step 3: Commit**

```bash
git add src/main/modes.ts
git commit -m "feat(modes): add optional examples field to Mode interface"
```

---

## Task 2: Replace DEFAULT_MODES with SuperWhisper prompts

**Files:**
- Modify: `src/main/modes.ts`
- Modify: `src/main/modes.test.ts`

**Step 1: Update the test for the new mode count**

`modes.test.ts` currently asserts `toHaveLength(4)` twice. Change both to `toHaveLength(6)`:

```typescript
// line 18 — default modes
expect(modes).toHaveLength(6)
// line 25 — loaded from config (MOCK_MODES still has 4 but test only checks length of parsed result)
```

Wait — the second `toHaveLength(4)` is checking a file-loaded result from `MOCK_MODES` which has 4 entries. That test should stay at 4 (it's testing that saved custom modes load correctly). Only the **first** test (default modes when no config) needs to change to 6.

**Step 1: Update the first length assertion in `modes.test.ts`**

```typescript
// Change line 18:
expect(modes).toHaveLength(6)
// Leave line 25 as toHaveLength(4) — it's testing custom-saved modes
```

**Step 2: Run test to confirm it fails**

```bash
yarn test src/main/modes.test.ts
```

Expected: FAIL — "expected 4 to be 6"

**Step 3: Replace DEFAULT_MODES in `modes.ts`**

Replace the entire `DEFAULT_MODES` constant (lines 15–81) with:

```typescript
const DEFAULT_MODES: Mode[] = [
  {
    id: 'message',
    name: 'Message',
    prompt: `You are a specialized text reformatting assistant. Your ONLY job is to clean up and reformat the user's text input.

CRITICAL INSTRUCTION: Your response must ONLY contain the cleaned text. Nothing else.

WHAT YOU DO:
- Fix grammar, spelling, and punctuation
- Remove speech artifacts ("um", "uh", false starts, repetitions)
- Correct homophones and standardize numbers/dates
- Break content into paragraphs, aim for 2-5 sentences per paragraph
- Maintain the original tone and intent
- Improve readability by splitting the text into paragraphs or sentences and questions onto new lines
- Replace common emoji descriptions with the emoji itself (e.g. smiley face -> 😊)

WHAT YOU NEVER DO:
- Answer questions (only reformat the question itself)
- Add new content not in the original message
- Provide responses or solutions to requests
- Add greetings, sign-offs, or explanations

WRONG BEHAVIOR - DO NOT DO THIS:
User: "what's the weather like"
Wrong: I don't have access to current weather data, but you can check...
Correct: What's the weather like?

Remember: You are a text editor, NOT a conversational assistant. Only reformat, never respond.`,
    hotkey: null,
    examples: [
      {
        input: 'Fix grammar, spelling and punctuation mistakes.\nwhat color is the sky',
        output: 'What color is the sky?',
      },
      {
        input: 'Write python script parse URL from string.',
        output: 'Write a Python script to parse a URL from a string.',
      },
      {
        input: 'hey there wondering if you have time to chat today actually tomorrow',
        output: 'Hey there, wondering if you have time to chat tomorrow.',
      },
    ],
  },
  {
    id: 'quick-note',
    name: 'Quick Note',
    prompt: `You are a note-taking specialist. Your job is to extract key information and organize it into structured notes.

CRITICAL INSTRUCTION: Your response must ONLY contain the structured notes. Nothing else.

NOTE FORMATTING REQUIREMENTS:
1. Structure text for effective note taking
2. Extract only information present in original message

WRONG BEHAVIOR - DO NOT DO THIS:
Wrong: Adding interpretations or assumptions`,
    hotkey: null,
    examples: [
      {
        input: 'Lecture covered Renaissance art. Key artists Leonardo da Vinci, Michelangelo. Important themes humanism and realism.',
        output: 'Renaissance Art Lecture:\n- Key Artists: Leonardo da Vinci, Michelangelo\n- Important Themes: Humanism and realism',
      },
      {
        input: 'Project update phase 1 done early. Phase 2 starting but code integration issues. Need to finish by Q3 end.',
        output: 'Project Status Update:\n- Phase 1: Completed ahead of schedule\n- Phase 2: Starting with code integration challenges\n- Deadline: End of Q3',
      },
      {
        input: 'Meeting about Q3 budget. Marketing needs 10% increase. Bob will draft proposal by Friday. Sarah agreed with timeline.',
        output: 'Q3 Budget Meeting:\n- Marketing department requires 10% budget increase\n- Bob assigned to draft proposal by Friday\n- Sarah confirmed agreement with proposed timeline',
      },
    ],
  },
  {
    id: 'email',
    name: 'Email',
    prompt: `You are an email formatting specialist. Your task is to transform user messages into professional email format.

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

WRONG BEHAVIOR - DO NOT DO THIS:
Wrong: Adding explanations, context, or content not in original
Wrong: Here's the formatted email: Hey there...
Wrong: Including signatures, names, or additional text after sign-off`,
    hotkey: null,
    examples: [
      {
        input: 'curious whats happening with the project timeline',
        output: 'Hey there,\n\nCurious, what\'s happening with the project timeline?\n\nThanks,',
      },
      {
        input: 'hey john was good seeing you would love to chat soon',
        output: 'Hey John,\n\nIt was good seeing you. Would love to chat soon.\n\nCheers,',
      },
      {
        input: 'we need to fix the database issue asap its blocking our progress. Take care',
        output: 'Hey,\n\nWe need to fix the database issue as soon as possible. It\'s blocking our progress.\n\nTake care,',
      },
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting',
    prompt: `You are a meeting transcript summarizer. Your job is to create structured summaries from actual meeting transcripts.

CRITICAL INSTRUCTION: Your response must ONLY contain the meeting summary. Nothing else.

SUMMARY FORMAT REQUIREMENTS:
1. Action items clearly marked with responsible person if applicable
2. Extract only information explicitly discussed
3. Action items list presented if clear action items are present in the meeting`,
    hotkey: null,
    examples: [
      {
        input: 'Meeting about Q3 budget. Marketing needs 10% increase. Bob will draft proposal by Friday. Sarah agreed with timeline.',
        output: 'Q3 Budget Meeting:\n- Marketing department requires 10% budget increase\n- Bob assigned to draft proposal by Friday\n- Sarah confirmed agreement with proposed timeline',
      },
    ],
  },
  {
    id: 'agent',
    name: 'Agent',
    prompt: `You are a prompt engineer. Transform the user's stream-of-consciousness dictation into a clear, direct instruction for an AI coding agent.

CRITICAL INSTRUCTION: Your response must ONLY contain the agent-ready instruction. Nothing else.

WHAT YOU DO:
- Start with a clear imperative: "Fix...", "Add...", "Refactor...", "Implement..."
- Include context (current state, what's broken, which files) after the main instruction
- List specific requirements or constraints as bullet points
- When the speaker contradicts themselves, use their LATEST stated preference
- When they express uncertainty, include it as a suggestion: "Consider using X" rather than "Use X"
- Preserve ALL technical terms, file paths, function names, and code identifiers exactly as spoken
- Strip every filler word, hedge, tangent, and verbal processing artifact

WHAT YOU NEVER DO:
- Add information the speaker didn't mention
- Ask questions or add caveats
- Add preamble, commentary, or sign-offs

WRONG BEHAVIOR - DO NOT DO THIS:
Wrong: "Here's the cleaned up instruction: ..."
Wrong: "I've transformed your request into the following prompt: ..."
Correct: Start directly with the imperative.`,
    hotkey: null,
    examples: [
      {
        input: 'um so the login page is broken uh when you submit the form nothing happens I think it might be the validation on the email field actually it might be the submit handler',
        output: 'Fix the login form submit handler — form submission does nothing when submitted.\n\n- Check the submit event handler for errors\n- Also investigate the email field validation as a possible cause\n- The issue is on the login page',
      },
    ],
  },
  {
    id: 'dev-note',
    name: 'Dev Note',
    prompt: `You are a technical writing assistant. Transform the spoken dictation into a clean, structured developer note.

CRITICAL INSTRUCTION: Your response must ONLY contain the developer note. Nothing else.

WHAT YOU DO:
- Write as a technical reference: clear, precise, and scannable
- Preserve ALL code identifiers, variable names, file paths, function names, and technical terms exactly as spoken
- Use bullet points for lists and numbered steps for sequential procedures
- Structure logically: what happened, why it matters, how to address it
- If the speaker describes bugs, gotchas, or warnings, call them out prominently

WHAT YOU NEVER DO:
- Add information not in the original message
- Add preamble, commentary, or sign-offs

WRONG BEHAVIOR - DO NOT DO THIS:
Wrong: "Here is your developer note: ..."
Correct: Start directly with the note content.`,
    hotkey: null,
    examples: [
      {
        input: 'heads up the useEffect in UserProfile dot tsx has a missing dependency it causes a stale closure when the userId prop changes you need to add userId to the dependency array',
        output: '**Bug: Stale closure in `UserProfile.tsx`**\n- `useEffect` missing `userId` in dependency array\n- Causes stale closure when `userId` prop changes\n- Fix: add `userId` to the `useEffect` deps array',
      },
    ],
  },
]
```

**Step 4: Run tests to confirm the modes test passes**

```bash
yarn test src/main/modes.test.ts
```

Expected: PASS

**Step 5: Run full test suite**

```bash
yarn test
```

Expected: all tests pass (only modes count changed).

**Step 6: Commit**

```bash
git add src/main/modes.ts src/main/modes.test.ts
git commit -m "feat(modes): replace prompts with SuperWhisper verbatim prompts, add Email and Meeting modes"
```

---

## Task 3: Refactor `summarizer.ts` to use SW-style prompt assembly

**Files:**
- Modify: `src/main/summarizer.ts`
- Modify: `src/main/summarizer.test.ts`

**Context:** Currently `summarize(rawText, systemPrompt)` takes a raw string. We need it to accept a `Mode` so it can access `mode.examples`. The `formatPrompt` function currently takes `(template, systemPrompt, userText)` — it needs to become `(template, mode, transcript)`.

**Step 1: Update the failing test first**

The existing summarizer test calls `summarize('Hello rambling text', 'Be concise.')` and `summarize('text', 'prompt')`. These will need to pass a `Mode` object instead. Update `summarizer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter, Readable } from 'stream'
import type { Mode } from './modes'

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))
vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('./settings', () => ({
  loadSettings: () => ({ hotkey: 'Control+Alt+Space', activeModel: 'smollm3-3b' }),
}))

import fs from 'fs'
vi.spyOn(fs, 'existsSync')

const mockMode: Mode = {
  id: 'message',
  name: 'Message',
  prompt: 'Be concise.',
  hotkey: null,
  examples: [],
}

describe('Summarizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('spawns llama-completion and yields streamed tokens', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const stdout = new Readable({ read() {} })
    const child = Object.assign(new EventEmitter(), {
      stdout,
      stderr: new Readable({ read() {} }),
    })
    mockSpawn.mockReturnValue(child)

    const { summarize } = await import('./summarizer')
    const tokens: string[] = []
    const gen = summarize('Hello rambling text', mockMode)

    setTimeout(() => {
      stdout.push('Hello')
      stdout.push(' world')
      stdout.push(null)
      child.emit('close', 0)
    }, 10)

    for await (const token of gen) {
      tokens.push(token)
    }
    expect(tokens.join('')).toBe('Hello world')
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('llama-completion'),
      expect.arrayContaining(['-m', expect.any(String), '--no-display-prompt']),
    )
  })

  it('throws if model file is missing', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const { summarize } = await import('./summarizer')
    const gen = summarize('text', mockMode)
    await expect(gen.next()).rejects.toThrow('Model not found')
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
yarn test src/main/summarizer.test.ts
```

Expected: FAIL — type error or "summarize is not a function matching signature"

**Step 3: Add `buildSystemPrompt` and `buildUserMessage` to `summarizer.ts`**

Add these two functions before the existing `formatPrompt` function (around line 96):

```typescript
import type { Mode } from './modes'

function buildSystemPrompt(): string {
  return [
    'You are a text reformatting function.',
    'You will be provided with instructions on how to reformat, respond to, or modify the user_message provided.',
    'Respond with the result of following the instructions and nothing else.',
  ].join('\n')
}

function buildUserMessage(
  modePrompt: string,
  transcript: string,
  examples: Array<{ input: string; output: string }> = [],
  language = 'English',
): string {
  const now = new Date()
  const timeStr = now.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en_US'

  const parts: string[] = [
    `INSTRUCTIONS:\n${modePrompt}`,
    '',
    `The user is speaking ${language}, reformatted message should also be in ${language}.`,
  ]

  if (examples.length > 0) {
    parts.push('')
    parts.push('EXAMPLES OF CORRECT BEHAVIOR:')
    for (const ex of examples) {
      parts.push(`User: ${ex.input}`)
      parts.push(`Assistant: ${ex.output}`)
    }
  }

  parts.push(
    '',
    'SYSTEM CONTEXT:',
    `Current time: ${timeStr}`,
    `Time zone: ${timezone}`,
    `Locale: ${locale}`,
    '',
    'USER MESSAGE:',
    transcript,
  )

  return parts.join('\n')
}
```

**Step 4: Replace `formatPrompt` and update `summarize` signature**

Replace the existing `formatPrompt` function (lines 96–103) and update the `summarize` signature (line 105):

```typescript
function formatPrompt(template: ChatTemplate, mode: Mode, transcript: string): string {
  const system = buildSystemPrompt()
  const user = buildUserMessage(mode.prompt, transcript, mode.examples ?? [])

  switch (template) {
    case 'chatml':
      return `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`
    case 'llama3':
      return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${user}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
  }
}

export async function* summarize(rawText: string, mode: Mode): AsyncGenerator<string> {
  const model = getActiveModelOption()
  const modelPath = getModelPath(model)

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model not found: ${modelPath}`)
  }

  const prompt = formatPrompt(model.chatTemplate, mode, rawText)
  // ... rest unchanged
```

Note: the `/no_think` prefix in the `chatml` template (`<|im_start|>system\n/no_think\n${system}`) was in the original `formatPrompt`. **Remove it** — it was a model-specific Qwen thinking-suppression token that the SW approach doesn't use.

**Step 5: Add the import for `Mode` at the top of `summarizer.ts`**

Add to the imports at the top:

```typescript
import type { Mode } from './modes'
```

**Step 6: Run summarizer tests**

```bash
yarn test src/main/summarizer.test.ts
```

Expected: PASS

**Step 7: Run full test suite — expect a pipeline-related TypeScript error**

```bash
yarn test
```

Expected: TypeScript error in `pipeline.ts` — `summarize` called with `activeMode.prompt` (string) instead of `activeMode` (Mode). That's fine — Task 4 fixes it.

**Step 8: Commit the summarizer changes**

```bash
git add src/main/summarizer.ts src/main/summarizer.test.ts
git commit -m "feat(summarizer): assemble SW-style system/user split prompt with examples and context"
```

---

## Task 4: Update `pipeline.ts` to pass `Mode` to `summarize`

**Files:**
- Modify: `src/main/pipeline.ts`

**Step 1: Update the `summarize` call in `stopRecording`**

In `pipeline.ts` around line 70, change:

```typescript
// Before:
for await (const token of summarize(rawText, activeMode.prompt)) {

// After:
for await (const token of summarize(rawText, activeMode)) {
```

**Step 2: Run full test suite**

```bash
yarn test
```

Expected: all tests PASS

**Step 3: TypeScript compile check**

```bash
yarn tsc --noEmit
```

Expected: no errors

**Step 4: Commit**

```bash
git add src/main/pipeline.ts
git commit -m "fix(pipeline): pass Mode object to summarize instead of prompt string"
```

---

## Task 5: Verify and create `docs/architecture.md`

The `prompt.md` workflow references `docs/architecture.md` as the canonical shared interfaces doc. It doesn't exist yet. Create a minimal version documenting the `Mode` interface and key architectural decisions from this session.

**Files:**
- Create: `docs/architecture.md`

**Step 1: Create `docs/architecture.md`**

```markdown
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
```

**Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture.md with Mode interface and A1 prompt decisions"
```

---

## Final Verification

```bash
yarn test
yarn tsc --noEmit
```

Both should pass cleanly. Then the branch is ready for PR/merge.
