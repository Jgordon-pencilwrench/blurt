import { app } from 'electron'
import { setupTray } from './tray'
import { loadModes } from './modes'
import { registerHotkey, unregisterAll } from './hotkey'
import { startPipeline } from './pipeline'
import { openPreferences } from './preferences-window'
import { runSetupIfNeeded } from './setup'
import { log } from './logger'

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', err)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)))
})

app.dock?.hide()

app.whenReady().then(async () => {
  log.info(`Blurt starting — pid ${process.pid}`)
  await runSetupIfNeeded()
  loadModes()
  setupTray(
    (mode) => console.log('Mode:', mode.name),
    () => openPreferences(),
    () => startPipeline(),
  )
  registerHotkey(() => startPipeline())
})

app.on('will-quit', () => unregisterAll())
app.on('window-all-closed', () => {})
