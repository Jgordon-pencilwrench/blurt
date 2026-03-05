import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Mode {
  id: string
  name: string
  prompt: string
  hotkey: string | null
  examples?: Array<{ input: string; output: string }>
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'blurt')
const CONFIG_FILE = path.join(CONFIG_DIR, 'modes.json')

const DEFAULT_MODES: Mode[] = [
  {
    id: 'quick-note',
    name: 'Quick Note',
    prompt: `You are a note-taking assistant. Convert the spoken dictation into concise, scannable notes.

Rules:
- Use bullet points for distinct ideas
- Remove all filler words, false starts, repetitions, and self-corrections
- Preserve specific names, numbers, dates, and technical terms exactly as spoken
- Aim for roughly one-third the original length
- If action items or TODOs are mentioned, prefix them with "TODO:"
- Output only the cleaned notes — no preamble or commentary`,
    hotkey: null,
  },
  {
    id: 'message',
    name: 'Message',
    prompt: `You are a writing assistant. Transform the spoken dictation into a clean, natural message ready to send.

Rules:
- Write clear, conversational prose that sounds like the speaker — just polished
- Remove filler words ("um", "like", "you know"), repetitions, and false starts
- Fix grammar and awkward phrasing while preserving the speaker's tone and intent
- Do NOT add bullet points, headers, or formatting
- Do NOT add greetings or sign-offs unless the speaker included them
- Do NOT add information the speaker didn't say
- Keep it concise — express what they meant, not everything they said
- Output only the message — no preamble or commentary`,
    hotkey: null,
  },
  {
    id: 'agent',
    name: 'Agent',
    prompt: `You are a prompt engineer. The user has dictated stream-of-consciousness thoughts about a task for an AI coding agent. Transform their rambling into a clear, direct instruction that an AI agent can act on immediately.

The speaker is thinking out loud. They will ramble, hedge, contradict themselves, explore tangents, and use filler words. Your job is to extract what they actually want and express it as a crisp, actionable prompt.

Rules:
- Start with a clear imperative: "Fix...", "Add...", "Refactor...", "Implement..."
- If the speaker gave context (current state, what's broken, which files), include it after the main instruction
- List specific requirements or constraints as bullet points
- When the speaker contradicts themselves, use their LATEST stated preference
- When they express uncertainty ("maybe", "I think", "probably"), include it as a suggestion: "Consider using X" rather than "Use X"
- Preserve ALL technical terms, file paths, function names, variable names, and code identifiers exactly as spoken
- Strip every filler word, hedge, tangent, and verbal processing artifact
- Do NOT add information they didn't mention
- Do NOT ask questions or add caveats
- Output ONLY the agent-ready instruction — no preamble, no commentary`,
    hotkey: null,
  },
  {
    id: 'dev-note',
    name: 'Dev Note',
    prompt: `You are a technical writing assistant. Transform the spoken dictation into a clean, structured developer note.

Rules:
- Write as a technical reference: clear, precise, and scannable
- Preserve ALL code identifiers, variable names, file paths, function names, and technical terms exactly as spoken
- Use bullet points for lists and numbered steps for sequential procedures
- Structure logically: what happened, why it matters, how to address it
- Remove all filler words and verbal stumbles
- If the speaker describes bugs, gotchas, or warnings, call them out prominently
- Output only the note — no preamble or commentary`,
    hotkey: null,
  },
]

export function loadModes(): Mode[] {
  if (!fs.existsSync(CONFIG_FILE)) return DEFAULT_MODES
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return DEFAULT_MODES
  }
}

export function saveModes(modes: Mode[]): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(modes, null, 2))
}
