import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      platform?: string
      transcribe: (buffer: ArrayBuffer) => Promise<string>
      notes: {
        list: () => Promise<{
          folders: string[]
          rootNotes: { id: string; title: string; updatedAt: number }[]
          folderNotes: Record<string, { id: string; title: string; updatedAt: number }[]>
        }>
        load: (id: string, folderId?: string) => Promise<{ id: string; title: string; content: string } | null>
        save: (data: { id: string; title: string; content: string; folderId?: string }) => Promise<boolean>
        create: (folderId?: string) => Promise<{ id: string; title: string; content: string; folderId?: string }>
      }
      folders: {
        create: (name: string) => Promise<boolean>
        rename: (oldName: string, newName: string) => Promise<boolean>
        delete: (name: string) => Promise<boolean>
        setMetadata: (name: string, metadata: { icon?: string; color?: string }) => Promise<boolean>
      }
      settings: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<boolean>
      }
      setTitleBarTheme: (themeId: string) => Promise<boolean>
      getPrivacySettings: () => Promise<{ shareAnalytics: boolean }>
      toggleAnalytics: () => Promise<{ shareAnalytics: boolean }>
      sendSentryTestEvent: () => Promise<{ sent: boolean }>
      sendAptabaseTestEvent: () => Promise<{ success: boolean; error?: string }>
      checkAiStatus: () => Promise<{ ready: boolean }>
      listAiModels: () => Promise<{
        models: { id: string; name: string; filename: string; sizeGb: string }[]
        downloaded: string[]
      }>
      getSelectedAiModel: () => Promise<{ id: string; name: string; filename: string; sizeGb: string }>
      setSelectedAiModel: (modelId: string) => Promise<boolean>
      downloadAiModel: (modelId: string) => Promise<{ success: boolean }>
      runSummary: (payload: { text: string; noteId?: string; folderId?: string }) => Promise<string>
      exportAudioAsWav: (dataUrl: string) => Promise<{ success: boolean; error?: string; canceled?: boolean }>
      onDownloadProgress: (callback: (percent: number) => void) => () => void
      getAppVersion: () => Promise<string>
      checkForUpdates: () => Promise<{
        success: boolean
        error?: string
        updateInfo?: { version: string; releaseNotes: unknown | null } | null
      }>
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>
      quitAndInstall: () => Promise<boolean>
      relaunchApp: () => Promise<boolean>
      onUpdateAvailable: (callback: (info: { version: string; releaseNotes: unknown | null }) => void) => () => void
      onUpdateDownloaded: (callback: (info: { version: string; releaseNotes: unknown | null }) => void) => () => void
      onUpdateDownloadProgress: (callback: (percent: number) => void) => () => void
      onUpdateError: (callback: (message: string) => void) => () => void
    }
  }
}
