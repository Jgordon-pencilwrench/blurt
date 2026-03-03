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
})
