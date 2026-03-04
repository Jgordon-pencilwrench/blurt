import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('prefsAPI', {
  getModes: () => ipcRenderer.invoke('get-modes'),
  saveModes: (modes: any[]) => ipcRenderer.invoke('save-modes', modes),
})
