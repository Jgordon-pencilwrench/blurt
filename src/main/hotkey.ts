import { globalShortcut } from 'electron'

const DEFAULT_HOTKEY = 'Control+Alt+Space'

export function registerHotkey(onTrigger: () => void): void {
  const registered = globalShortcut.register(DEFAULT_HOTKEY, onTrigger)
  if (!registered) console.error('Hotkey registration failed')
}

export function unregisterAll() {
  globalShortcut.unregisterAll()
}
