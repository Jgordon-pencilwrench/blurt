import { app } from 'electron'
import { setupTray } from './tray'
import { loadModes } from './modes'
import { registerHotkey, unregisterAll } from './hotkey'
import { startPipeline } from './pipeline'

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
app.dock?.hide()

app.whenReady().then(async () => {
  loadModes()
  setupTray(
    (mode) => console.log('Mode:', mode.name),
    () => console.log('TODO: open preferences')
  )
  registerHotkey(() => startPipeline())
})

app.on('will-quit', () => unregisterAll())
app.on('window-all-closed', () => {})
