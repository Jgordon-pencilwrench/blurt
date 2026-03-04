import { globalShortcut } from 'electron'
import { loadSettings } from './settings'

let currentCallback: (() => void) | null = null
let currentKey = 'Control+Alt+Space'

export function registerHotkey(onTrigger: () => void): void {
  currentCallback = onTrigger
  currentKey = loadSettings().hotkey
  const ok = globalShortcut.register(currentKey, onTrigger)
  if (!ok) console.error(`Hotkey registration failed: ${currentKey}`)
}

export function updateHotkey(newKey: string): boolean {
  if (!currentCallback) return false
  globalShortcut.unregister(currentKey)
  const ok = globalShortcut.register(newKey, currentCallback)
  if (ok) {
    currentKey = newKey
  } else {
    // Restore previous hotkey
    globalShortcut.register(currentKey, currentCallback)
  }
  return ok
}

export function unregisterAll() {
  globalShortcut.unregisterAll()
}
