import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronCompact', {
  setPinned: (pinned: boolean) => ipcRenderer.send('set-compact-pinned', pinned),
  openReport: (sessionId: string, reportId: string) =>
    ipcRenderer.send('compact-open-report', { sessionId, reportId }),
  openMainApp: () => ipcRenderer.send('open-main-app'),
})
