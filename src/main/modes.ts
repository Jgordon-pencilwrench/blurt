import fs from 'fs'
import path from 'path'
import os from 'os'

export interface Mode {
  id: string
  name: string
  prompt: string
  hotkey: string | null
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'blurt')
const CONFIG_FILE = path.join(CONFIG_DIR, 'modes.json')

const DEFAULT_MODES: Mode[] = [
  {
    id: 'quick-note',
    name: 'Quick Note',
    prompt: 'Compress to gist. Bullet points as appropriate. Remove filler words. Be concise.',
    hotkey: null,
  },
  {
    id: 'message',
    name: 'Message',
    prompt: 'Clean up into conversational prose. Remove filler words. No bullet points.',
    hotkey: null,
  },
  {
    id: 'agent',
    name: 'Agent',
    prompt: 'Terse and direct. Technical. Remove all filler. Optimised for pasting into an AI agent or Claude Code.',
    hotkey: null,
  },
  {
    id: 'dev-note',
    name: 'Dev Note',
    prompt: 'Technical note. Preserve code identifiers and variable names exactly. Bullet points for steps.',
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
