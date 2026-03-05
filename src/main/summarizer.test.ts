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
