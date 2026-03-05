import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const mockExecFile = vi.fn()
vi.mock('child_process', () => ({ execFile: mockExecFile }))
vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('ffmpeg-static', () => ({ default: '/mock/ffmpeg' }))
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Hello world  \n'),
  unlinkSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}))

describe('Whisper model helpers', () => {
  it('whisperModelFileExists returns true when file is present', async () => {
    vi.resetModules()
    const { whisperModelFileExists } = await import('./transcriber')
    const { WHISPER_CATALOG } = await import('./model-catalog')
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    expect(whisperModelFileExists(WHISPER_CATALOG[0])).toBe(true)
  })

  it('whisperModelFileExists returns false when file is absent', async () => {
    vi.resetModules()
    const { whisperModelFileExists } = await import('./transcriber')
    const { WHISPER_CATALOG } = await import('./model-catalog')
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)
    expect(whisperModelFileExists(WHISPER_CATALOG[0])).toBe(false)
  })
})

describe('Transcriber', () => {
  beforeEach(() => {
    mockExecFile.mockReset()
    // Both ffmpeg and whisper-cli succeed
    mockExecFile.mockImplementation((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, '', '')
    })
  })

  it('preprocesses audio then calls whisper-cli with preprocessed path', async () => {
    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    await transcribe('/tmp/test.wav')

    // First call: ffmpeg
    expect(mockExecFile.mock.calls[0][0]).toContain('ffmpeg')
    expect(mockExecFile.mock.calls[0][1]).toContain('/tmp/test.wav')

    // Second call: whisper-cli with preprocessed path
    expect(mockExecFile.mock.calls[1][0]).toContain('whisper-cli')
    expect(mockExecFile.mock.calls[1][1]).toContain('/tmp/test-preprocessed.wav')
  })

  it('returns trimmed and hallucination-stripped text', async () => {
    const { readFileSync } = await import('fs')
    vi.mocked(readFileSync).mockReturnValue('Hello world\n[Music]\n')

    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    const result = await transcribe('/tmp/test.wav')

    expect(result).toBe('Hello world')
  })

  it('cleans up preprocessed wav and original on whisper failure', async () => {
    // First call (ffmpeg) succeeds, second call (whisper) fails
    mockExecFile
      .mockImplementationOnce((_bin: string, _args: string[], _opts: object, cb: Function) => {
        cb(null, '', '')
      })
      .mockImplementationOnce((_bin: string, _args: string[], _opts: object, cb: Function) => {
        cb(new Error('whisper crashed'), '', '')
      })

    const { unlinkSync } = await import('fs')
    vi.mocked(unlinkSync).mockClear()

    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    await expect(transcribe('/tmp/test.wav')).rejects.toThrow('whisper crashed')

    const unlinkedPaths = vi.mocked(unlinkSync).mock.calls.map((c: unknown[]) => c[0])
    expect(unlinkedPaths).toContain('/tmp/test-preprocessed.wav')
    expect(unlinkedPaths).toContain('/tmp/test.wav')
  })

  it('cleans up preprocessed wav, txt output, and original wav', async () => {
    const { unlinkSync } = await import('fs')
    vi.mocked(unlinkSync).mockClear()

    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    await transcribe('/tmp/test.wav')

    const unlinkedPaths = vi.mocked(unlinkSync).mock.calls.map((c: unknown[]) => c[0])
    expect(unlinkedPaths).toContain('/tmp/test-preprocessed.wav.txt')
    expect(unlinkedPaths).toContain('/tmp/test-preprocessed.wav')
    expect(unlinkedPaths).toContain('/tmp/test.wav')
  })

  it('uses requested model path when that model is downloaded', async () => {
    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    await transcribe('/tmp/test.wav', 'tiny.en')

    const whisperArgs: string[] = mockExecFile.mock.calls[1][1]
    const modelArg = whisperArgs[whisperArgs.indexOf('-m') + 1]
    expect(modelArg).toContain('tiny.en')
  })

  it('falls back to base.en when requested model is not downloaded', async () => {
    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) =>
      typeof p === 'string' && p.includes('base.en')
    )
    await transcribe('/tmp/test.wav', 'tiny.en')

    const whisperArgs: string[] = mockExecFile.mock.calls[1][1]
    const modelArg = whisperArgs[whisperArgs.indexOf('-m') + 1]
    expect(modelArg).toContain('base.en')
  })

  it('passes --prompt to whisper-cli when initialPrompt is provided', async () => {
    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    await transcribe('/tmp/test.wav', undefined, 'TypeScript, React, useState')

    const whisperArgs: string[] = mockExecFile.mock.calls[1][1]
    expect(whisperArgs).toContain('--prompt')
    expect(whisperArgs[whisperArgs.indexOf('--prompt') + 1]).toBe('TypeScript, React, useState')
  })

  it('does not pass --prompt to whisper-cli when initialPrompt is undefined', async () => {
    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    await transcribe('/tmp/test.wav')

    const whisperArgs: string[] = mockExecFile.mock.calls[1][1]
    expect(whisperArgs).not.toContain('--prompt')
  })

  it('does not pass --prompt to whisper-cli when initialPrompt is empty string', async () => {
    vi.resetModules()
    const { transcribe } = await import('./transcriber')
    await transcribe('/tmp/test.wav', undefined, '')

    const whisperArgs: string[] = mockExecFile.mock.calls[1][1]
    expect(whisperArgs).not.toContain('--prompt')
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

describe('preprocessAudio', () => {
  let preprocessAudio: (wavPath: string) => Promise<string>

  beforeAll(async () => {
    vi.resetModules()
    const mod = await import('./transcriber')
    preprocessAudio = mod.preprocessAudio
  })

  beforeEach(() => {
    mockExecFile.mockReset()
    mockExecFile.mockImplementation((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, '', '')
    })
  })

  it('calls ffmpeg with loudnorm + silenceremove filter chain', async () => {
    await preprocessAudio('/tmp/recording.wav')

    expect(mockExecFile).toHaveBeenCalledWith(
      '/mock/ffmpeg',
      expect.arrayContaining([
        '-i', '/tmp/recording.wav',
        '-af', expect.stringContaining('loudnorm'),
        '-ar', '16000',
        '-ac', '1',
        '-y',
      ]),
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('the ffmpeg -af filter also includes silenceremove', async () => {
    await preprocessAudio('/tmp/recording.wav')

    const call = mockExecFile.mock.calls[0]
    const args: string[] = call[1]
    const afIndex = args.indexOf('-af')
    expect(afIndex).toBeGreaterThan(-1)
    expect(args[afIndex + 1]).toContain('silenceremove')
  })

  it('returns a path ending in -preprocessed.wav', async () => {
    const result = await preprocessAudio('/tmp/recording.wav')
    expect(result).toMatch(/-preprocessed\.wav$/)
  })

  it('rejects if ffmpeg exits with an error', async () => {
    mockExecFile.mockImplementation((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(new Error('ffmpeg failed'), '', '')
    })
    await expect(preprocessAudio('/tmp/recording.wav')).rejects.toThrow('ffmpeg failed')
  })

  it('rejects immediately if ffmpegPath is null', async () => {
    // Temporarily override the mock to return null
    vi.doMock('ffmpeg-static', () => ({ default: null }))
    vi.resetModules()
    const { preprocessAudio: freshPreprocess } = await import('./transcriber')
    await expect(freshPreprocess('/tmp/recording.wav')).rejects.toThrow('ffmpeg binary not found')
    // Restore original mock
    vi.doMock('ffmpeg-static', () => ({ default: '/mock/ffmpeg' }))
    vi.resetModules()
  })
})
