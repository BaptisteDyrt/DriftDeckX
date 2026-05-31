const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  read: () => ipcRenderer.invoke('storage:read'),
  write: (presets) => ipcRenderer.invoke('storage:write', presets)
})