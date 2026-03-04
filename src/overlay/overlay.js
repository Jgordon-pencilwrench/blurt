// State management
function showState(id) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

// Waveform visualization
const canvas = document.getElementById('waveform')
const ctx = canvas.getContext('2d')
let analyser, animFrame

// Audio recording state
let audioCtx, mediaStream, scriptNode, pcmChunks

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
    const intensity = data[i] / 255
    ctx.fillStyle = `rgba(240,165,0,${0.25 + intensity * 0.75})`
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
    x += barWidth + 1
  }
}

function stopWaveform() {
  if (animFrame) cancelAnimationFrame(animFrame)
  animFrame = null
}

function encodeWAV(samples, sampleRate) {
  const numSamples = samples.length
  const buf = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buf)

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)           // chunk size
  view.setUint16(20, 1, true)            // PCM format
  view.setUint16(22, 1, true)            // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)            // block align
  view.setUint16(34, 16, true)           // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s * 0x7fff, true)
  }

  return new Uint8Array(buf)
}

async function startRecording() {
  pcmChunks = []
  audioCtx = new AudioContext({ sampleRate: 16000 })
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const source = audioCtx.createMediaStreamSource(mediaStream)

  // Waveform analyser
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)
  drawWaveform()

  // PCM capture
  scriptNode = audioCtx.createScriptProcessor(4096, 1, 1)
  scriptNode.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    pcmChunks.push(new Float32Array(input))
  }
  source.connect(scriptNode)
  scriptNode.connect(audioCtx.destination)
}

function stopRecording() {
  stopWaveform()

  // Concatenate PCM chunks into single Float32Array
  const totalLen = pcmChunks.reduce((sum, c) => sum + c.length, 0)
  const merged = new Float32Array(totalLen)
  let offset = 0
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  // Encode and send WAV to main process
  const wavBytes = encodeWAV(merged, 16000)
  window.electronAPI.sendRecordingData(wavBytes)

  // Cleanup
  if (scriptNode) { scriptNode.disconnect(); scriptNode = null }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
  if (audioCtx) { audioCtx.close(); audioCtx = null }
  pcmChunks = []
}

function pauseRecording() {
  if (audioCtx && audioCtx.state === 'running') audioCtx.suspend()
  stopWaveform()
}

function resumeRecording() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
  drawWaveform()
}

// Listen for recording commands from main process
window.electronAPI.onRecordingCommand((command) => {
  if (command === 'start') startRecording()
  else if (command === 'stop') stopRecording()
  else if (command === 'pause') pauseRecording()
  else if (command === 'resume') resumeRecording()
})

// Pause state
let isPaused = false

function setRecordingVisual(paused) {
  const dot = document.querySelector('.rec-dot')
  const label = document.getElementById('rec-label')
  const pauseBtn = document.getElementById('pause-btn')

  if (paused) {
    dot.style.background = 'rgba(255,245,220,0.3)'
    dot.style.animationPlayState = 'paused'
    label.textContent = 'Paused'
    pauseBtn.textContent = 'Resume'
    pauseBtn.classList.add('primary-btn')
    pauseBtn.classList.remove('ghost-btn')
  } else {
    dot.style.background = ''
    dot.style.animationPlayState = ''
    label.textContent = 'Listening\u2026'
    pauseBtn.textContent = 'Pause'
    pauseBtn.classList.remove('primary-btn')
    pauseBtn.classList.add('ghost-btn')
  }
}

// Pending rAF handle for batched markdown re-renders
let _renderFrame = null

// IPC from main process
window.electronAPI.onState((state, data) => {
  if (state === 'recording') {
    showState('recording-state')
    isPaused = false
    setRecordingVisual(false)
  } else if (state === 'paused') {
    isPaused = true
    setRecordingVisual(true)
  } else if (state === 'processing') {
    stopWaveform()
    document.getElementById('status-text').textContent = data || 'Transcribing...'
    showState('processing-state')
  } else if (state === 'streaming') {
    window._rawOutput = ''
    if (_renderFrame) { cancelAnimationFrame(_renderFrame); _renderFrame = null }
    document.getElementById('output-text').innerHTML = ''
    showState('streaming-state')
  } else if (state === 'token') {
    window._rawOutput = (window._rawOutput || '') + data
    // Batch re-renders to one per animation frame — avoids O(n²) work on long output
    if (!_renderFrame) {
      _renderFrame = requestAnimationFrame(() => {
        const el = document.getElementById('output-text')
        el.innerHTML = marked.parse(window._rawOutput)
        el.scrollTop = el.scrollHeight
        _renderFrame = null
      })
    }
  } else if (state === 'done') {
    // Flush any pending render immediately so final output is complete
    if (_renderFrame) {
      cancelAnimationFrame(_renderFrame)
      _renderFrame = null
      const el = document.getElementById('output-text')
      el.innerHTML = marked.parse(window._rawOutput)
    }
    document.getElementById('done-status').textContent = data || ''
  } else if (state === 'error') {
    stopWaveform()
    document.getElementById('error-text').textContent = data || 'An error occurred'
    showState('error-state')
  }
})

// Button handlers
document.getElementById('stop-btn').addEventListener('click', () => {
  window.electronAPI.send('overlay-stop')
})
document.getElementById('pause-btn').addEventListener('click', () => {
  if (isPaused) {
    window.electronAPI.send('overlay-resume')
  } else {
    window.electronAPI.send('overlay-pause')
  }
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
