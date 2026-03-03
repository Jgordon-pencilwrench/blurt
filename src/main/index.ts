import { app, BrowserWindow } from 'electron'

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Hide from Dock — menubar only
app.dock?.hide()

app.whenReady().then(async () => {
  // Tray, hotkey, setup wizard wired in later tasks
  console.log('Blurt ready')
})

app.on('window-all-closed', () => {
  // Don't quit when all windows close — we live in the tray
})
