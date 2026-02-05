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
      checkAiStatus: () => Promise<{ ready: boolean }>
      downloadAiModel: () => Promise<{ success: boolean }>
      onDownloadProgress: (callback: (percent: number) => void) => () => void
    }
  }
}
