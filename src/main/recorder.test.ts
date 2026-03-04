import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendToOverlay = vi.fn()
vi.mock('./overlay-window', () => ({
  sendToOverlay: mockSendToOverlay,
}))

let ipcOnceCallback: Function | null = null
vi.mock('electron', () => ({
  ipcMain: {
    once: (_channel: string, cb: Function) => { ipcOnceCallback = cb },
    removeAllListeners: vi.fn(),
  },
}))

import fs from 'fs'
vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})

describe('Recorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ipcOnceCallback = null
  })

  it('sends start command to overlay and returns wav path', async () => {
    const { Recorder } = await import('./recorder')
    const recorder = new Recorder()
    const outPath = recorder.start()

    expect(mockSendToOverlay).toHaveBeenCalledWith('recording-command', 'start')
    expect(outPath).toMatch(/\.wav$/)
    expect(recorder.isRecording).toBe(true)
  })

  it('sends stop command and writes received WAV data to file', async () => {
    const fakeWav = new Uint8Array([1, 2, 3, 4])

    const { Recorder } = await import('./recorder')
    const recorder = new Recorder()
    recorder.start()

    const stopPromise = recorder.stop()

    // Simulate overlay sending back WAV data
    expect(ipcOnceCallback).not.toBeNull()
    ipcOnceCallback!({}, fakeWav)

    const wavPath = await stopPromise

    expect(mockSendToOverlay).toHaveBeenCalledWith('recording-command', 'stop')
    expect(fs.writeFileSync).toHaveBeenCalledWith(wavPath, expect.any(Buffer))
    expect(recorder.isRecording).toBe(false)
  })
})
