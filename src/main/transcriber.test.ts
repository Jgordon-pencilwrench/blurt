import { describe, it, expect, vi } from 'vitest'

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
