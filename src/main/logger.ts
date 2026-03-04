import fs from 'fs'
import path from 'path'
import { app } from 'electron'

function getLogPath(): string {
  const logsDir = app.getPath('logs')
  fs.mkdirSync(logsDir, { recursive: true })
  return path.join(logsDir, 'main.log')
}

function write(level: string, message: string, error?: unknown): void {
  const ts = new Date().toISOString()
  let line = `${ts} [${level}] ${message}`
  if (error instanceof Error) {
    line += `\n  ${error.message}`
    if (error.stack) line += `\n  ${error.stack.split('\n').slice(1).join('\n  ')}`
  } else if (error !== undefined) {
    line += `\n  ${String(error)}`
  }
  line += '\n'
  try {
    fs.appendFileSync(getLogPath(), line)
  } catch {
    process.stderr.write(line)
  }
}

export const log = {
  info:  (message: string, error?: unknown) => write('INFO',  message, error),
  warn:  (message: string, error?: unknown) => write('WARN',  message, error),
  error: (message: string, error?: unknown) => write('ERROR', message, error),
}
