import { describe, it, expect, vi } from 'vitest'

const mockExecSync = vi.fn()
vi.mock('child_process', () => ({ execSync: mockExecSync }))
vi.mock('electron', () => ({ clipboard: { writeText: vi.fn() } }))

describe('Typer', () => {
  it('captures frontmost app name', async () => {
    mockExecSync.mockReturnValue(Buffer.from('iTerm2\n'))
    const { getFrontmostApp } = await import('./typer')
    const app = getFrontmostApp()
    expect(app).toBe('iTerm2')
  })

  it('types text into the given app via osascript', async () => {
    mockExecSync.mockReturnValue(Buffer.from(''))
    const { typeIntoApp } = await import('./typer')
    typeIntoApp('hello world', 'iTerm2')
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('keystroke'),
      expect.any(Object)
    )
  })
})
