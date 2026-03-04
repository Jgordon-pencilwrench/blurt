import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'
import { loadModes, Mode } from './modes'

let tray: Tray | null = null
let activeModeId = 'quick-note'
let _onModeChange: (mode: Mode) => void = () => {}
let _onPreferences: () => void = () => {}
let _onStartRecording: () => void = () => {}

export function getActiveModeId() { return activeModeId }

export function rebuildTrayMenu() {
  rebuildMenu(_onModeChange, _onPreferences, _onStartRecording)
}

export function setupTray(
  onModeChange: (mode: Mode) => void,
  onPreferences: () => void,
  onStartRecording: () => void,
) {
  _onModeChange = onModeChange
  _onPreferences = onPreferences
  _onStartRecording = onStartRecording

  const iconPath = path.join(__dirname, '../../assets/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Blurt')
  rebuildMenu(onModeChange, onPreferences, onStartRecording)
}

function rebuildMenu(
  onModeChange: (mode: Mode) => void,
  onPreferences: () => void,
  onStartRecording: () => void,
) {
  const modes = loadModes()
  const modeItems = modes.map((mode) => ({
    label: mode.name,
    type: 'radio' as const,
    checked: mode.id === activeModeId,
    click: () => {
      activeModeId = mode.id
      onModeChange(mode)
      tray?.setToolTip(`Blurt — ${mode.name}`)
      rebuildMenu(onModeChange, onPreferences, onStartRecording)
    },
  }))

  const menu = Menu.buildFromTemplate([
    { label: 'Start Recording', click: onStartRecording, accelerator: 'Control+Alt+Space' },
    { type: 'separator' },
    ...modeItems,
    { type: 'separator' },
    { label: 'Preferences...', click: onPreferences },
    { type: 'separator' },
    { label: 'Quit Blurt', click: () => app.quit() },
  ])
  tray?.setContextMenu(menu)
}
