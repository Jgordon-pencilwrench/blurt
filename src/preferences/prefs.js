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
  hideAllPanels()
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
  hideAllPanels()
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

function hideAllPanels() {
  editor.classList.add('hidden')
  settingsPanel.classList.add('hidden')
  modelPanel.classList.add('hidden')
  generalBtn.classList.remove('selected')
  modelBtn.classList.remove('selected')
  document.querySelectorAll('.mode-item').forEach(el => el.classList.remove('selected'))
}

function showSettingsPanel() {
  hideAllPanels()
  emptyState.classList.add('hidden')
  settingsPanel.classList.remove('hidden')
  selectedIndex = -1
  generalBtn.classList.add('selected')
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

// ── Model panel section ──────────────────────────────────

const modelPanel = document.getElementById('model-panel')
const modelList  = document.getElementById('model-list')
const modelBtn   = document.getElementById('model-btn')
let modelData = null
let downloadingModelId = null

function showModelPanel() {
  hideAllPanels()
  emptyState.classList.add('hidden')
  modelPanel.classList.remove('hidden')
  selectedIndex = -1
  modelBtn.classList.add('selected')
  renderModelPanel()
}

async function renderModelPanel() {
  modelData = await window.prefsAPI.getModelStatus()
  modelList.innerHTML = ''

  modelData.catalog.forEach(m => {
    const row = document.createElement('div')
    row.className = 'model-row' + (m.active ? ' active' : '')
    row.id = 'model-row-' + m.id

    let actions = ''
    if (m.downloaded && m.active) {
      actions = `<span class="badge-active">Active</span>`
    } else if (m.downloaded) {
      actions = `
        <button class="model-btn model-btn-activate" data-action="activate" data-id="${m.id}">Use</button>
        <button class="model-btn model-btn-delete" data-action="delete" data-id="${m.id}">Delete</button>
      `
    } else {
      actions = `
        <button class="model-btn model-btn-download" data-action="download" data-id="${m.id}">Download</button>
      `
    }

    row.innerHTML = `
      <div class="model-row-info">
        <div class="model-row-name">
          ${m.name}
          <span class="badge-size">${m.size}</span>
        </div>
        <div class="model-row-meta">${m.speed} &middot; ${m.description}</div>
        <div class="model-progress" id="progress-${m.id}" style="display:none">
          <div class="model-progress-bar"><div class="model-progress-fill" id="fill-${m.id}"></div></div>
          <div class="model-progress-text" id="ptext-${m.id}"></div>
        </div>
      </div>
      <div class="model-row-actions">${actions}</div>
    `
    modelList.appendChild(row)
  })

  // Attach event handlers
  modelList.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action
      const id = btn.dataset.id
      if (action === 'activate') {
        await window.prefsAPI.setActiveModel(id)
        renderModelPanel()
      } else if (action === 'download') {
        downloadingModelId = id
        btn.disabled = true
        btn.textContent = 'Downloading\u2026'
        document.getElementById('progress-' + id).style.display = 'block'
        try {
          await window.prefsAPI.downloadModel(id)
          downloadingModelId = null
          renderModelPanel()
        } catch {
          btn.disabled = false
          btn.textContent = 'Retry'
          downloadingModelId = null
        }
      } else if (action === 'delete') {
        if (confirm('Delete this model? You can re-download it later.')) {
          await window.prefsAPI.deleteModel(id)
          renderModelPanel()
        }
      }
    })
  })
}

window.prefsAPI.onModelDownloadProgress(data => {
  const fill = document.getElementById('fill-' + data.modelId)
  const text = document.getElementById('ptext-' + data.modelId)
  if (fill) fill.style.width = data.percent + '%'
  if (text) text.textContent = data.downloadedMB.toFixed(1) + ' / ' + data.totalMB.toFixed(1) + ' MB'
})

modelBtn.addEventListener('click', showModelPanel)
