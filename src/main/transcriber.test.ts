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

describe('Transcriber', () => {
  it('calls whisper-cli with correct args and returns trimmed text', async () => {
    mockExecFile.mockImplementation((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, '', '')
    })

    const { transcribe } = await import('./transcriber')
    const result = await transcribe('/tmp/test.wav')

    expect(mockExecFile).toHaveBeenCalledWith(
      expect.stringContaining('whisper-cli'),
      expect.arrayContaining([
        '-f', '/tmp/test.wav',
        '--output-txt',
        '--no-speech-thr', '0.6',
        '--logprob-thr', '-1.0',
        '--compression-ratio-thr', '2.4',
        '--temperature', '0',
        '--temperature-inc', '0.2',
        '--beam-size', '3',
        '--language', 'en',
      ]),
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
})
