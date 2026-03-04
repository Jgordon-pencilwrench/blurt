import fs from 'fs'
import path from 'path'
import os from 'os'

const configDir = path.join(os.homedir(), '.config', 'blurt')
const settingsPath = path.join(configDir, 'settings.json')

export interface Settings {
  hotkey: string
}

const DEFAULTS: Settings = {
  hotkey: 'Control+Alt+Space',
}

export function loadSettings(): Settings {
  try {
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    return { ...DEFAULTS, ...data }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: Settings): void {
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}
