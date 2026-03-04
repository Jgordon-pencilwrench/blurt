import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('setupAPI', {
  getStatus: () => ipcRenderer.invoke('setup-status'),
  openOllama: () => ipcRenderer.invoke('open-ollama'),
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  pullModel: () => ipcRenderer.invoke('pull-model'),
  onPullProgress: (cb: (msg: string) => void) => {
    ipcRenderer.on('pull-progress', (_e, msg) => cb(msg))
  },
  requestMic: () => ipcRenderer.invoke('request-mic'),
  requestAccessibility: () => ipcRenderer.invoke('request-accessibility'),
  complete: () => ipcRenderer.invoke('setup-complete'),
})
