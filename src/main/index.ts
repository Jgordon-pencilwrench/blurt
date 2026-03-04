import { app } from 'electron'
import { setupTray } from './tray'
import { loadModes } from './modes'
import { registerHotkey, unregisterAll } from './hotkey'
import { startPipeline } from './pipeline'
import { openPreferences } from './preferences-window'
import { runSetupIfNeeded } from './setup'

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
app.dock?.hide()

app.whenReady().then(async () => {
  await runSetupIfNeeded()
  loadModes()
  setupTray(
    (mode) => console.log('Mode:', mode.name),
    () => openPreferences()
  )
  registerHotkey(() => startPipeline())
})

app.on('will-quit', () => unregisterAll())
app.on('window-all-closed', () => {})
