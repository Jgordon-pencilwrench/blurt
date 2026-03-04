import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('prefsAPI', {
  getModes:     () => ipcRenderer.invoke('get-modes'),
  saveModes:    (modes: any[]) => ipcRenderer.invoke('save-modes', modes),
  getSettings:  () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  getModelStatus: () => ipcRenderer.invoke('get-model-status'),
  downloadModel: (modelId: string) => ipcRenderer.invoke('download-model', modelId),
  setActiveModel: (modelId: string) => ipcRenderer.invoke('set-active-model', modelId),
  deleteModel: (modelId: string) => ipcRenderer.invoke('delete-model', modelId),
  onModelDownloadProgress: (cb: (data: { modelId: string; percent: number; downloadedMB: number; totalMB: number }) => void) => {
    ipcRenderer.on('model-download-progress', (_e, data) => cb(data))
  },
})
