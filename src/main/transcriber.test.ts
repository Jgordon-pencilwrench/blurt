import { describe, it, expect, vi, beforeAll } from 'vitest'

const mockExecFile = vi.fn()
vi.mock('child_process', () => ({ execFile: mockExecFile }))
vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Hello world  \n'),
  unlinkSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}))

describe('Transcriber', () => {
  it('calls whisper-cli with correct args and returns trimmed text', async () => {
    mockExecFile.mockImplementation((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, '', '')
    })

    const { transcribe } = await import('./transcriber')
    const result = await transcribe('/tmp/test.wav')

    expect(mockExecFile).toHaveBeenCalledWith(
      expect.stringContaining('whisper-cli'),
      expect.arrayContaining(['-f', '/tmp/test.wav', '--output-txt']),
      expect.any(Object),
      expect.any(Function)
    )
    expect(result).toBe('Hello world')
  })
})

describe('stripHallucinations', () => {
  let stripHallucinations: (text: string) => string

  beforeAll(async () => {
    const mod = await import('./transcriber')
    stripHallucinations = mod.stripHallucinations
  })

  it('strips "Thanks for watching" lines', () => {
    const input = 'Hello world\nThanks for watching\nBye'
    expect(stripHallucinations(input)).toBe('Hello world\nBye')
  })

  it('strips "[Music]" lines', () => {
    expect(stripHallucinations('[Music]\nReal content')).toBe('Real content')
  })

  it('strips "[Applause]" lines', () => {
    expect(stripHallucinations('Good point\n[Applause]')).toBe('Good point')
  })

  it('strips "Subtitles by ..." lines', () => {
    expect(stripHallucinations('content\nSubtitles by Rev.com')).toBe('content')
  })

  it('strips URL-only lines', () => {
    expect(stripHallucinations('content\nwww.example.com')).toBe('content')
  })

  it('passes through normal transcript lines untouched', () => {
    const normal = 'Let me tell you about the project.\nWe need to fix the bug in the auth module.'
    expect(stripHallucinations(normal)).toBe(normal)
  })

  it('handles empty string', () => {
    expect(stripHallucinations('')).toBe('')
  })

  it('trims leading/trailing whitespace from the result', () => {
    expect(stripHallucinations('\nHello\n[Music]\n')).toBe('Hello')
  })
})
