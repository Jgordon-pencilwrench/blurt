let modes = []
let editingIndex = -1

const modesList = document.getElementById('modes-list')
const editor = document.getElementById('editor')
const editorTitle = document.getElementById('editor-title')
const modeName = document.getElementById('mode-name')
const modePrompt = document.getElementById('mode-prompt')

async function load() {
  modes = await window.prefsAPI.getModes()
  render()
}

function render() {
  modesList.innerHTML = ''
  modes.forEach((mode, i) => {
    const row = document.createElement('div')
    row.className = 'mode-row'
    row.innerHTML = `
      <div>
        <div class="mode-row-name">${mode.name}</div>
        <div class="mode-row-prompt">${mode.prompt}</div>
      </div>
      <span class="mode-row-edit">Edit →</span>
    `
    row.addEventListener('click', () => openEditor(i))
    modesList.appendChild(row)
  })
}

function openEditor(index) {
  editingIndex = index
  const isNew = index === -1
  editorTitle.textContent = isNew ? 'New Mode' : 'Edit Mode'
  modeName.value = isNew ? '' : modes[index].name
  modePrompt.value = isNew ? '' : modes[index].prompt
  document.getElementById('delete-btn').style.display = isNew ? 'none' : ''
  editor.classList.remove('hidden')
  modeName.focus()
}

document.getElementById('add-btn').addEventListener('click', () => openEditor(-1))

document.getElementById('save-btn').addEventListener('click', async () => {
  const name = modeName.value.trim()
  const prompt = modePrompt.value.trim()
  if (!name || !prompt) return

  if (editingIndex === -1) {
    modes.push({ id: name.toLowerCase().replace(/\s+/g, '-'), name, prompt, hotkey: null })
  } else {
    modes[editingIndex] = { ...modes[editingIndex], name, prompt }
  }

  await window.prefsAPI.saveModes(modes)
  editor.classList.add('hidden')
  render()
})

document.getElementById('delete-btn').addEventListener('click', async () => {
  if (editingIndex === -1) return
  modes.splice(editingIndex, 1)
  await window.prefsAPI.saveModes(modes)
  editor.classList.add('hidden')
  render()
})

document.getElementById('cancel-btn').addEventListener('click', () => {
  editor.classList.add('hidden')
})

load()
