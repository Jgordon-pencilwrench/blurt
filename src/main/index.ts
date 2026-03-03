import { app } from 'electron'
import { setupTray } from './tray'
import { loadModes } from './modes'

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }
app.dock?.hide()

app.whenReady().then(async () => {
  loadModes() // ensure config dir exists
  setupTray(
    (mode) => console.log('Mode changed to:', mode.name),
    () => console.log('Open preferences')
  )
})

app.on('window-all-closed', () => {})
