import { BrowserWindow, screen } from 'electron'
import path from 'path'

let overlayWin: BrowserWindow | null = null

export function showOverlay(): BrowserWindow {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.show()
    return overlayWin
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWin = new BrowserWindow({
    width: 520,
    height: 140,
    x: Math.round(width / 2 - 260),
    y: Math.round(height - 220),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'overlay-preload.js'),
    },
  })

  overlayWin.loadFile(path.join(__dirname, '../../src/overlay/index.html'))
  overlayWin.setIgnoreMouseEvents(false)
  return overlayWin
}

export function hideOverlay() {
  overlayWin?.hide()
}

export function sendToOverlay(channel: string, ...args: any[]) {
  overlayWin?.webContents.send(channel, ...args)
}
