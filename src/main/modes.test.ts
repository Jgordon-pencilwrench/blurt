import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'

vi.mock('fs')

const MOCK_MODES = [
  { id: 'quick-note', name: 'Quick Note', prompt: 'Compress to gist, bullet points as appropriate. Remove filler words.', hotkey: null },
  { id: 'message', name: 'Message', prompt: 'Clean up into conversational prose. Remove filler words. No bullet points.', hotkey: null },
  { id: 'agent', name: 'Agent', prompt: 'Terse and direct. Technical. Remove all filler. Optimised for pasting into an AI agent.', hotkey: null },
  { id: 'dev-note', name: 'Dev Note', prompt: 'Technical note. Preserve code identifiers and variable names exactly. Bullet points for steps.', hotkey: null },
]

describe('modes', () => {
  it('returns default modes when config file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const { loadModes } = await import('./modes')
    const modes = loadModes()
    expect(modes).toHaveLength(6)
    expect(modes[0].id).toBe('message')
  })

  it('loads modes from config file when it exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(MOCK_MODES))
    const { loadModes } = await import('./modes')
    const modes = loadModes()
    expect(modes).toHaveLength(4)
  })

  it('default modes have whisperModel set', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.resetModules()
    const { loadModes } = await import('./modes')
    const modes = loadModes()
    const meeting = modes.find(m => m.id === 'meeting')
    const message = modes.find(m => m.id === 'message')
    const quickNote = modes.find(m => m.id === 'quick-note')
    expect(meeting?.whisperModel).toBe('medium.en')
    expect(message?.whisperModel).toBe('tiny.en')
    expect(quickNote?.whisperModel).toBe('tiny.en')
  })

  it('saves modes to config file', async () => {
    const writeSpy = vi.mocked(fs.writeFileSync)
    const { saveModes } = await import('./modes')
    saveModes(MOCK_MODES)
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('modes.json'),
      JSON.stringify(MOCK_MODES, null, 2)
    )
  })
})
