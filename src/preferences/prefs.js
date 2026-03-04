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
