import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  platform: process.platform as string,
  transcribe: (buffer: ArrayBuffer) => ipcRenderer.invoke('transcribe-audio', buffer),
  checkAiStatus: () => ipcRenderer.invoke('check-ai-status') as Promise<{ ready: boolean }>,
  downloadAiModel: () => ipcRenderer.invoke('download-ai-model') as Promise<{ success: boolean }>,
  onDownloadProgress: (callback: (percent: number) => void) => {
    const fn = (_: unknown, percent: number) => callback(percent)
    ipcRenderer.on('download-progress', fn)
    return () => ipcRenderer.removeListener('download-progress', fn)
  },
  notes: {
    list: () => ipcRenderer.invoke('notes-list'),
    load: (id: string, folderId?: string) => ipcRenderer.invoke('notes-load', id, folderId),
    save: (data: { id: string; title: string; content: string; folderId?: string }) =>
      ipcRenderer.invoke('notes-save', data),
    create: (folderId?: string) => ipcRenderer.invoke('notes-create', folderId)
  },
  folders: {
    create: (name: string) => ipcRenderer.invoke('folder-create', name),
    rename: (oldName: string, newName: string) => ipcRenderer.invoke('folder-rename', oldName, newName),
    delete: (name: string) => ipcRenderer.invoke('folder-delete', name),
    setMetadata: (name: string, metadata: { icon?: string; color?: string }) =>
      ipcRenderer.invoke('folder-metadata-set', name, metadata)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings-get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings-set', key, value)
  },
  setTitleBarTheme: (themeId: string) => ipcRenderer.invoke('set-title-bar-theme', themeId),
  getPrivacySettings: () => ipcRenderer.invoke('get-privacy-settings') as Promise<{ shareAnalytics: boolean }>,
  toggleAnalytics: () => ipcRenderer.invoke('toggle-analytics') as Promise<{ shareAnalytics: boolean }>,
  sendSentryTestEvent: () => ipcRenderer.invoke('sentry-test-event') as Promise<{ sent: boolean }>
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
