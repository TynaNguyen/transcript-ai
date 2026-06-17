import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronCompact', {
  setPinned: (pinned: boolean) => ipcRenderer.send('set-compact-pinned', pinned),
})
