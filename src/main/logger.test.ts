import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const TEST_LOG_DIR = path.join(os.tmpdir(), 'blurt-logger-test-' + process.pid)
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'main.log')

vi.mock('electron', () => ({
  app: { getPath: (key: string) => key === 'logs' ? TEST_LOG_DIR : os.tmpdir() }
}))

import { log } from './logger'

describe('logger', () => {
  beforeEach(() => fs.mkdirSync(TEST_LOG_DIR, { recursive: true }))
  afterEach(() => fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true }))

  it('writes an info entry to the log file', () => {
    log.info('hello world')
    const content = fs.readFileSync(TEST_LOG_FILE, 'utf8')
    expect(content).toContain('[INFO]')
    expect(content).toContain('hello world')
  })

  it('writes an error entry with stack trace', () => {
    log.error('something broke', new Error('test error'))
    const content = fs.readFileSync(TEST_LOG_FILE, 'utf8')
    expect(content).toContain('[ERROR]')
    expect(content).toContain('something broke')
    expect(content).toContain('test error')
  })

  it('writes a warn entry', () => {
    log.warn('watch out')
    const content = fs.readFileSync(TEST_LOG_FILE, 'utf8')
    expect(content).toContain('[WARN]')
    expect(content).toContain('watch out')
  })
})
