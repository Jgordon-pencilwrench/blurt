// State management
function showState(id) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

// Waveform visualization
const canvas = document.getElementById('waveform')
const ctx = canvas.getContext('2d')
let analyser, animFrame

async function startWaveform() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    drawWaveform()
  } catch (e) {
    console.warn('Waveform unavailable:', e)
  }
}

function drawWaveform() {
  animFrame = requestAnimationFrame(drawWaveform)
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const barWidth = (canvas.width / data.length) * 2.5
  let x = 0
  for (let i = 0; i < data.length; i++) {
    const barHeight = (data[i] / 255) * canvas.height
    ctx.fillStyle = `rgba(0,0,0,${0.3 + (data[i] / 255) * 0.7})`
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
    x += barWidth + 1
  }
}

function stopWaveform() {
  if (animFrame) cancelAnimationFrame(animFrame)
}

// IPC from main process
window.electronAPI.onState((state, data) => {
  if (state === 'recording') {
    showState('recording-state')
    startWaveform()
  } else if (state === 'processing') {
    stopWaveform()
    document.getElementById('status-text').textContent = data || 'Transcribing...'
    showState('processing-state')
  } else if (state === 'streaming') {
    window._rawOutput = ''
    document.getElementById('output-text').innerHTML = ''
    showState('streaming-state')
  } else if (state === 'token') {
    window._rawOutput = (window._rawOutput || '') + data
    // Re-render full markdown on each token so formatting is always correct
    document.getElementById('output-text').innerHTML = marked.parse(window._rawOutput)
  } else if (state === 'done') {
    document.getElementById('done-status').textContent = data || ''
  }
})

// Button handlers
document.getElementById('stop-btn').addEventListener('click', () => {
  window.electronAPI.send('overlay-stop')
})
document.getElementById('cancel-btn').addEventListener('click', () => {
  window.electronAPI.send('overlay-cancel')
})
document.getElementById('close-btn').addEventListener('click', () => {
  window.electronAPI.send('overlay-close')
})

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.electronAPI.send('overlay-cancel')
  if (e.key === ' ' && e.altKey) window.electronAPI.send('overlay-stop')
})
