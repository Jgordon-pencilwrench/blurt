import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { loadSettings, saveSettings } from './settings'

let overlayWin: BrowserWindow | null = null

export function showOverlay(): BrowserWindow {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.show()
    return overlayWin
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const settings = loadSettings()

  const x = settings.overlayX ?? Math.round(width / 2 - 260)
  const y = settings.overlayY ?? Math.round(height - 220)

  overlayWin = new BrowserWindow({
    width: 520,
    height: 140,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
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

  overlayWin.on('moved', () => {
    if (!overlayWin) return
    const [posX, posY] = overlayWin.getPosition()
    const s = loadSettings()
    saveSettings({ ...s, overlayX: posX, overlayY: posY })
  })

  overlayWin.loadFile(path.join(__dirname, '../../src/overlay/index.html'))
  overlayWin.setIgnoreMouseEvents(false)
  return overlayWin
}

export function hideOverlay() {
  overlayWin?.hide()
  // Reset to compact height for next recording session
  overlayWin?.setSize(520, 140)
}

export function setOverlayHeight(height: number) {
  if (!overlayWin) return
  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const [x, currentY] = overlayWin.getPosition()
  const newY = Math.min(currentY, screenHeight - height)
  overlayWin.setBounds({ x, y: Math.max(0, newY), width: 520, height })
}

export function sendToOverlay(channel: string, ...args: any[]) {
  overlayWin?.webContents.send(channel, ...args)
}
