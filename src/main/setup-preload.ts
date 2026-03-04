import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('setupAPI', {
  getStatus: () => ipcRenderer.invoke('setup-status'),
  selectAndDownloadModel: (modelId: string) => ipcRenderer.invoke('select-and-download-model', modelId),
  onDownloadProgress: (cb: (data: { modelId: string; percent: number; downloadedMB: number; totalMB: number }) => void) => {
    ipcRenderer.on('download-progress', (_e, data) => cb(data))
  },
  requestMic: () => ipcRenderer.invoke('request-mic'),
  requestAccessibility: () => ipcRenderer.invoke('request-accessibility'),
  onAccessibilityGranted: (cb: () => void) => {
    ipcRenderer.on('accessibility-granted', () => cb())
  },
  complete: () => ipcRenderer.invoke('setup-complete'),
})
