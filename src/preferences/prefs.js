let modes = []
let selectedIndex = -1
let isDirty = false

const modesList   = document.getElementById('modes-list')
const editor      = document.getElementById('editor')
const emptyState  = document.getElementById('empty-state')
const editorTitle = document.getElementById('editor-title')
const modeName    = document.getElementById('mode-name')
const modePrompt  = document.getElementById('mode-prompt')
const deleteBtn   = document.getElementById('delete-btn')

async function load() {
  modes = await window.prefsAPI.getModes()
  renderList()
}

function renderList() {
  modesList.innerHTML = ''
  modes.forEach((mode, i) => {
    const item = document.createElement('div')
    item.className = 'mode-item' + (i === selectedIndex ? ' selected' : '')
    item.innerHTML = `
      <div class="mode-item-name">${mode.name}</div>
      <div class="mode-item-preview">${mode.prompt}</div>
    `
    item.addEventListener('click', () => selectMode(i))
    modesList.appendChild(item)
  })
}

function selectMode(index) {
  hideSettingsPanel()
  selectedIndex = index
  const mode = modes[index]
  editorTitle.textContent = 'Edit Mode'
  modeName.value = mode.name
  modePrompt.value = mode.prompt
  deleteBtn.style.display = ''
  isDirty = false
  showEditor()
  renderList()
}

function newMode() {
  hideSettingsPanel()
  selectedIndex = -1
  editorTitle.textContent = 'New Mode'
  modeName.value = ''
  modePrompt.value = ''
  deleteBtn.style.display = 'none'
  isDirty = false
  showEditor()
  renderList()
  modeName.focus()
}

function showEditor() {
  editor.classList.remove('hidden')
  emptyState.classList.add('hidden')
}

function hideEditor() {
  editor.classList.add('hidden')
  emptyState.classList.remove('hidden')
  selectedIndex = -1
  renderList()
}

document.getElementById('add-btn').addEventListener('click', newMode)

document.getElementById('save-btn').addEventListener('click', async () => {
  const name   = modeName.value.trim()
  const prompt = modePrompt.value.trim()
  if (!name || !prompt) {
    modeName.focus()
    return
  }
  if (selectedIndex === -1) {
    modes.push({ id: name.toLowerCase().replace(/\s+/g, '-'), name, prompt, hotkey: null })
    selectedIndex = modes.length - 1
  } else {
    modes[selectedIndex] = { ...modes[selectedIndex], name, prompt }
  }
  await window.prefsAPI.saveModes(modes)
  isDirty = false
  renderList()
})

document.getElementById('delete-btn').addEventListener('click', async () => {
  if (selectedIndex === -1) return
  modes.splice(selectedIndex, 1)
  await window.prefsAPI.saveModes(modes)
  hideEditor()
})

document.getElementById('cancel-btn').addEventListener('click', hideEditor)

load()

// ── Settings section ──────────────────────────────────────

const settingsPanel = document.getElementById('settings-panel')
const hotkeyCapture = document.getElementById('hotkey-capture')
const hotkeyDisplay = document.getElementById('hotkey-display')
const hotkeyError   = document.getElementById('hotkey-error')
const generalBtn    = document.getElementById('general-btn')

let savedHotkey = 'Control+Alt+Space'
let pendingHotkey = savedHotkey
let isCapturing = false

function toDisplay(electronKey) {
  return electronKey
    .replace('Control', '⌃')
    .replace('Alt', '⌥')
    .replace('Meta', '⌘')
    .replace('Shift', '⇧')
    .replace(/\+/g, '')
}

function fromKeyEvent(e) {
  const mods = []
  if (e.ctrlKey)  mods.push('Control')
  if (e.altKey)   mods.push('Alt')
  if (e.metaKey)  mods.push('Meta')
  if (e.shiftKey) mods.push('Shift')
  const isModifier = ['Control', 'Alt', 'Meta', 'Shift'].includes(e.key)
  if (mods.length === 0 || isModifier) return null
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
  return [...mods, key].join('+')
}

async function loadSettingsData() {
  const settings = await window.prefsAPI.getSettings()
  savedHotkey = settings.hotkey
  pendingHotkey = savedHotkey
  hotkeyDisplay.textContent = toDisplay(savedHotkey)
}

function showSettingsPanel() {
  editor.classList.add('hidden')
  emptyState.classList.add('hidden')
  settingsPanel.classList.remove('hidden')
  selectedIndex = -1
  generalBtn.classList.add('selected')
  // Deselect any mode
  document.querySelectorAll('.mode-item').forEach(el => el.classList.remove('selected'))
  hotkeyError.textContent = ''
  hotkeyDisplay.textContent = toDisplay(savedHotkey)
  pendingHotkey = savedHotkey
}

function hideSettingsPanel() {
  settingsPanel.classList.add('hidden')
  generalBtn.classList.remove('selected')
}

generalBtn.addEventListener('click', showSettingsPanel)

// Hotkey capture
hotkeyCapture.addEventListener('click', () => {
  if (isCapturing) return
  isCapturing = true
  hotkeyCapture.classList.add('capturing')
  hotkeyCapture.querySelector('.hotkey-hint').textContent = 'Press shortcut…'
  hotkeyCapture.querySelector('.hotkey-hint').style.display = 'block'
  hotkeyCapture.focus()
})

hotkeyCapture.addEventListener('keydown', (e) => {
  if (!isCapturing) return
  e.preventDefault()
  e.stopPropagation()

  if (e.key === 'Escape') {
    // Cancel capture
    isCapturing = false
    hotkeyCapture.classList.remove('capturing')
    hotkeyDisplay.textContent = toDisplay(pendingHotkey)
    return
  }

  const combo = fromKeyEvent(e)
  if (!combo) return  // still waiting for a non-modifier key

  isCapturing = false
  hotkeyCapture.classList.remove('capturing')
  pendingHotkey = combo
  hotkeyDisplay.textContent = toDisplay(combo)
  hotkeyError.textContent = ''
})

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const result = await window.prefsAPI.saveSettings({ hotkey: pendingHotkey })
  if (result.ok) {
    savedHotkey = pendingHotkey
    hotkeyError.textContent = ''
    hideSettingsPanel()
    emptyState.classList.remove('hidden')
  } else {
    hotkeyError.textContent = result.error || 'Could not register shortcut'
  }
})

document.getElementById('settings-cancel-btn').addEventListener('click', () => {
  pendingHotkey = savedHotkey
  hideSettingsPanel()
  emptyState.classList.remove('hidden')
})

// Load settings on startup
loadSettingsData()
