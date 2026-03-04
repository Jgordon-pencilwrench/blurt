import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onState: (cb: (state: string, data?: string) => void) => {
    ipcRenderer.on('overlay-state', (_e, state, data) => cb(state, data))
  },
  onReady: (cb: () => void) => {
    ipcRenderer.on('overlay-ready', () => cb())
  },
  send: (channel: string) => {
    ipcRenderer.send(channel)
  },
  onRecordingCommand: (cb: (command: string) => void) => {
    ipcRenderer.on('recording-command', (_e, command) => cb(command))
  },
  sendRecordingData: (buffer: Uint8Array) => {
    ipcRenderer.send('recording-data', buffer)
  },
})
