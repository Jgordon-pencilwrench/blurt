import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'
import { loadModes, Mode } from './modes'

let tray: Tray | null = null
let activeModeId = 'quick-note'

export function getActiveModeId() { return activeModeId }

export function setupTray(onModeChange: (mode: Mode) => void, onPreferences: () => void) {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Blurt')
  rebuildMenu(onModeChange, onPreferences)
}

function rebuildMenu(onModeChange: (mode: Mode) => void, onPreferences: () => void) {
  const modes = loadModes()
  const modeItems = modes.map((mode) => ({
    label: mode.name,
    type: 'radio' as const,
    checked: mode.id === activeModeId,
    click: () => {
      activeModeId = mode.id
      onModeChange(mode)
      tray?.setToolTip(`Blurt — ${mode.name}`)
      rebuildMenu(onModeChange, onPreferences)
    },
  }))

  const menu = Menu.buildFromTemplate([
    ...modeItems,
    { type: 'separator' },
    { label: 'Preferences...', click: onPreferences },
    { type: 'separator' },
    { label: 'Quit Blurt', click: () => app.quit() },
  ])
  tray?.setContextMenu(menu)
}
