# Prompt Improvements for Blurt
*Replace Blurt's existing prompts with SuperWhisper's verbatim prompts and assembly technique.*

---

## The Core Technique: System/User Split

SuperWhisper sends a **minimal, generic system prompt** and puts all the specifics — the mode's instructions, examples, language declaration, and system context — in the **user message**. Evidence from the live recording in `meta.json`:

The `prompt` field (what goes in the user role) contains the full assembled block. The system role gets only:

```
You are a text reformatting function.
You will be provided with instructions on how to reformat, respond to, or modify the user_message provided.
Respond with the result of following the instructions and nothing else.
```

This works better across model families because many fine-tuned models are trained to follow instructions in the user turn rather than the system turn.

---

## The Assembled Prompt Template

Every LLM call uses this structure in the user message (reconstructed from the binary + verified against a live `meta.json` recording):

```
INSTRUCTIONS:
{mode system prompt}

The user is speaking {language}, reformatted message should also be in {language}.

EXAMPLES OF CORRECT BEHAVIOR:
User: {example_input_1}
Assistant: {example_output_1}
User: {example_input_2}
Assistant: {example_output_2}
[...more examples...]

SYSTEM CONTEXT:
Current time: {e.g. "March 3, 2026 at 4:49 PM"}
Time zone: {e.g. "America/New_York"}
Locale: {e.g. "en_US"}

USER MESSAGE:
{raw transcript}
```

### Implementation in `summarizer.ts`

Replace the current `formatPrompt` function with this two-part builder:

```typescript
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

Then update `formatPrompt` to use these:

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
```

Also add `examples` to the `Mode` interface in `modes.ts`:

```typescript
export interface Mode {
  id: string
  name: string
  prompt: string
  hotkey: string | null
  examples?: Array<{ input: string; output: string }>
}
```

---

## Updated Mode Definitions

Replace the `DEFAULT_MODES` array in `modes.ts` with the following. Where a direct SuperWhisper equivalent exists, the prompt and examples are verbatim from the binary. The Agent and Dev Note modes have no SW equivalent — they use SW's structural technique applied to Blurt-specific content.

### Message
*Verbatim SuperWhisper "Message mode" prompt + verbatim examples from binary*

```typescript
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
```

### Quick Note
*Verbatim SuperWhisper "Notes mode" prompt + verbatim examples from binary*

```typescript
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
```

### Email
*Verbatim SuperWhisper "Email mode" prompt + verbatim examples from binary. New mode for Blurt.*

```typescript
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
```

### Meeting
*Verbatim SuperWhisper "Meeting mode" prompt + verbatim example from binary. New mode for Blurt.*

```typescript
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
```

### Agent
*No SuperWhisper equivalent. SW structural technique applied to Blurt-specific content.*

```typescript
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
```

### Dev Note
*No SuperWhisper equivalent. SW structural technique applied to Blurt-specific content.*

```typescript
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
```

---

## Output Stripping

Even with tight prompts, small local models occasionally add a one-word preamble or sign-off. Add a stripping pass in `pipeline.ts` after the full response is assembled (not during streaming):

```typescript
function stripPreamble(text: string): string {
  const preamblePatterns = [
    /^Here(?:'s| is) (?:the |your )?(?:cleaned |formatted |structured )?(?:text|message|email|note|summary|result)[:\s]*/i,
    /^Sure[,!]?\s*/i,
    /^Of course[,!]?\s*/i,
    /^Certainly[,!]?\s*/i,
  ]
  let result = text.trim()
  for (const pattern of preamblePatterns) {
    result = result.replace(pattern, '')
  }
  return result.trim()
}
```

Apply it to `fullText` before `clipboard.writeText(fullText)` and `typeIntoApp(fullText, ...)`.
