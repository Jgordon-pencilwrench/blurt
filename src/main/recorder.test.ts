import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChildProcess } from 'child_process'

const mockSpawn = vi.fn()
vi.mock('child_process', () => ({ spawn: mockSpawn }))

describe('Recorder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('spawns sox with correct args when recording starts', async () => {
    const mockProcess = { kill: vi.fn(), on: vi.fn() } as unknown as ChildProcess
    mockSpawn.mockReturnValue(mockProcess)

    const { Recorder } = await import('./recorder')
    const recorder = new Recorder()
    const outPath = recorder.start()

    expect(mockSpawn).toHaveBeenCalledWith(
      'sox',
      expect.arrayContaining(['-t', 'coreaudio', 'default', expect.stringContaining('.wav')]),
      expect.any(Object)
    )
    expect(outPath).toMatch(/\.wav$/)
  })

  it('kills the sox process when stop is called', async () => {
    const mockProcess = { kill: vi.fn(), on: vi.fn() } as unknown as ChildProcess
    mockSpawn.mockReturnValue(mockProcess)

    const { Recorder } = await import('./recorder')
    const recorder = new Recorder()
    recorder.start()
    recorder.stop()

    expect(mockProcess.kill).toHaveBeenCalled()
  })
})
