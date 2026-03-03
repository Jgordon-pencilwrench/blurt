import { describe, it, expect, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Summarizer', () => {
  it('streams tokens from Ollama and yields them', async () => {
    const chunks = [
      JSON.stringify({ response: 'Hello', done: false }) + '\n',
      JSON.stringify({ response: ' world', done: false }) + '\n',
      JSON.stringify({ response: '', done: true }) + '\n',
    ]
    const encoder = new TextEncoder()
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) yield encoder.encode(chunk)
      }
    }
    mockFetch.mockResolvedValue({ ok: true, body: mockStream })

    const { summarize } = await import('./summarizer')
    const tokens: string[] = []
    for await (const token of summarize('Hello rambling text', 'Be concise.')) {
      tokens.push(token)
    }
    expect(tokens).toEqual(['Hello', ' world'])
  })

  it('throws if Ollama is not reachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const { summarize } = await import('./summarizer')
    const gen = summarize('text', 'prompt')
    await expect(gen.next()).rejects.toThrow('ECONNREFUSED')
  })
})
