import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync, existsSync, readdirSync, readFileSync, mkdirSync, renameSync, rmSync, createWriteStream } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { privacyStore } from './store'
import * as Sentry from '@sentry/electron/main'
import { initialize as aptabaseInitialize, trackEvent as aptabaseTrackEvent } from '@aptabase/electron/main'

const isWindows = process.platform === 'win32'

// Privacy-first crash reporting: only send if user opted in
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://5fae01abe192da9057d224c5fe7f494d@o4510830153433088.ingest.us.sentry.io/4510830313406464',
  beforeSend(event) {
    if (!privacyStore.get('shareAnalytics')) return null
    return event
  }
})

// Aptabase must be initialized before app is ready
aptabaseInitialize(process.env.APTABASE_KEY || 'A-US-6714554317').catch(() => {
  /* ignore */
})

// Theme colors for title bar overlay (sidebar bg, symbol/icon color)
const THEME_OVERLAY_COLORS: Record<string, { color: string; symbolColor: string }> = {
  primary: { color: '#231e1a', symbolColor: '#d7c097' },
  ocean: { color: '#0c1222', symbolColor: '#e2e8f0' },
  forest: { color: '#141914', symbolColor: '#c8e6c9' },
  rose: { color: '#171412', symbolColor: '#faf5f5' }
}

function getTitleBarThemeColors(): { color: string; symbolColor: string } {
  try {
    const settingsPath = join(app.getPath('documents'), 'Locus', '.settings.json')
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
      const themeId = settings?.theme
      if (themeId && THEME_OVERLAY_COLORS[themeId]) {
        return THEME_OVERLAY_COLORS[themeId]
      }
    }
  } catch {
    /* use default */
  }
  return THEME_OVERLAY_COLORS.primary
}

let mainWindowRef: BrowserWindow | null = null

function createWindow(): void {
  const { color: SIDEBAR_COLOR, symbolColor } = getTitleBarThemeColors()
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    title: 'Locus',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: SIDEBAR_COLOR,
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: SIDEBAR_COLOR,
            symbolColor,
            height: 40
          }
        }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindowRef = mainWindow
  mainWindow.on('closed', () => {
    mainWindowRef = null
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Privacy-first analytics: only send events if user opted in
function trackEvent(eventName: string, props?: Record<string, string | number | boolean>): void {
  if (!privacyStore.get('shareAnalytics')) return
  aptabaseTrackEvent(eventName, props).catch(() => {
    /* ignore analytics errors */
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.locus')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Privacy settings (analytics opt-in)
  ipcMain.handle('get-privacy-settings', () => ({
    shareAnalytics: privacyStore.get('shareAnalytics')
  }))
  ipcMain.handle('toggle-analytics', () => {
    const next = !privacyStore.get('shareAnalytics')
    privacyStore.set('shareAnalytics', next)
    return { shareAnalytics: next }
  })
  ipcMain.handle('sentry-test-event', () => {
    if (!privacyStore.get('shareAnalytics')) return { sent: false }
    Sentry.captureException(new Error('Locus test event (main process)'))
    return { sent: true }
  })

  trackEvent('app_started')

  // Update title bar overlay when theme changes (Windows/Linux)
  ipcMain.handle('set-title-bar-theme', (_event, themeId: string) => {
    const colors = THEME_OVERLAY_COLORS[themeId] ?? THEME_OVERLAY_COLORS.primary
    if (mainWindowRef && (process.platform === 'win32' || process.platform === 'linux')) {
      mainWindowRef.setTitleBarOverlay({
        color: colors.color,
        symbolColor: colors.symbolColor,
        height: 40
      })
    }
    return true
  })

  // Notes persistence - store in Documents/Locus
  const getNotesFolder = () => {
    const folder = join(app.getPath('documents'), 'Locus')
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true })
    return folder
  }

  const listNotesInDir = (dir: string): { id: string; title: string; updatedAt: number }[] => {
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.json') && !f.startsWith('.')
    )
    return files
      .map((f) => {
        try {
          const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
          const id = data?.id
          if (!id || typeof id !== 'string') return null
          return { id, title: data.title || 'Untitled', updatedAt: data.updatedAt || 0 }
        } catch {
          return null
        }
      })
      .filter((x): x is { id: string; title: string; updatedAt: number } => x != null)
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
  }

  const getFolderMetadataPath = () => join(getNotesFolder(), '.folders.json')
  const getSettingsPath = () => join(getNotesFolder(), '.settings.json')

  const loadSettings = (): Record<string, unknown> => {
    const path = getSettingsPath()
    if (!existsSync(path)) return {}
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return {}
    }
  }

  const saveSettings = (settings: Record<string, unknown>) => {
    writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2))
  }

  ipcMain.handle('settings-get', (_event, key: string) => {
    const settings = loadSettings()
    return settings[key]
  })

  ipcMain.handle('settings-set', (_event, key: string, value: unknown) => {
    const settings = loadSettings()
    settings[key] = value
    saveSettings(settings)
    return true
  })

  const loadFolderMetadata = (): Record<string, { icon: string; color: string }> => {
    const path = getFolderMetadataPath()
    if (!existsSync(path)) return {}
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      return {}
    }
  }

  const saveFolderMetadata = (meta: Record<string, { icon: string; color: string }>) => {
    writeFileSync(getFolderMetadataPath(), JSON.stringify(meta, null, 2))
  }

  ipcMain.handle('notes-list', () => {
    try {
      const base = getNotesFolder()
      const entries = readdirSync(base, { withFileTypes: true })
      const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
      const rootNotes = listNotesInDir(base)
      const folderNotes: Record<string, { id: string; title: string; updatedAt: number }[]> = {}
      for (const name of folders) {
        folderNotes[name] = listNotesInDir(join(base, name))
      }
      const folderMetadata = loadFolderMetadata()
      return { folders, rootNotes, folderNotes, folderMetadata }
    } catch (err) {
      console.error('notes-list failed:', err)
      return { folders: [], rootNotes: [], folderNotes: {}, folderMetadata: {} }
    }
  })

  ipcMain.handle('folder-metadata-set', (_event, name: string, metadata: { icon?: string; color?: string }) => {
    const meta = loadFolderMetadata()
    meta[name] = { ...(meta[name] ?? { icon: '📁', color: '#e8b840' }), ...metadata }
    saveFolderMetadata(meta)
    return true
  })

  ipcMain.handle('notes-load', (_event, id: string, folderId?: string) => {
    const base = getNotesFolder()
    const dir = folderId ? join(base, folderId) : base
    const path = join(dir, `${id}.json`)
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8'))
  })

  ipcMain.handle('notes-save', (_event, data: { id: string; title: string; content: string; folderId?: string }) => {
    const base = getNotesFolder()
    const dir = data.folderId ? join(base, data.folderId) : base
    const payload = { id: data.id, title: data.title, content: data.content, updatedAt: Date.now() }
    writeFileSync(join(dir, `${data.id}.json`), JSON.stringify(payload, null, 2))
    return true
  })

  ipcMain.handle('notes-create', (_event, folderId?: string) => {
    const id = `note-${Date.now()}`
    const base = getNotesFolder()
    const dir = folderId ? join(base, folderId) : base
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const payload = { id, title: 'Untitled Note', content: '', updatedAt: Date.now() }
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(payload, null, 2))
    return { ...payload, folderId }
  })

  ipcMain.handle('notes-delete', (_event, id: string, folderId?: string) => {
    const base = getNotesFolder()
    const dir = folderId ? join(base, folderId) : base
    const path = join(dir, `${id}.json`)
    if (!existsSync(path)) return true // Already gone - treat as success (idempotent)
    unlinkSync(path)
    return true
  })

  ipcMain.handle('folder-create', (_event, name: string) => {
    const base = getNotesFolder()
    const dir = join(base, name)
    if (existsSync(dir)) throw new Error('Folder already exists')
    mkdirSync(dir, { recursive: true })
    return true
  })

  ipcMain.handle('folder-rename', (_event, oldName: string, newName: string) => {
    const base = getNotesFolder()
    const oldPath = join(base, oldName)
    const newPath = join(base, newName)
    if (!existsSync(oldPath)) throw new Error('Folder not found')
    if (existsSync(newPath)) throw new Error('Folder already exists')
    renameSync(oldPath, newPath)
    const meta = loadFolderMetadata()
    if (meta[oldName]) {
      meta[newName] = meta[oldName]
      delete meta[oldName]
      saveFolderMetadata(meta)
    }
    return true
  })

  ipcMain.handle('folder-delete', (_event, name: string) => {
    const base = getNotesFolder()
    const dir = join(base, name)
    if (!existsSync(dir)) throw new Error('Folder not found')
    rmSync(dir, { recursive: true })
    const meta = loadFolderMetadata()
    if (meta[name]) {
      delete meta[name]
      saveFolderMetadata(meta)
    }
    return true
  })

  // Transcribe audio via bundled transcriber executable (PyInstaller)
  const getTranscriberPath = (): string => {
    const binaryName = isWindows ? 'transcriber.exe' : 'transcriber'
    if (app.isPackaged) {
      return join(process.resourcesPath, binaryName)
    }
    return join(app.getAppPath(), 'python_backend', 'dist', binaryName)
  }

  ipcMain.handle('transcribe-audio', async (_event, audioBuffer: ArrayBuffer) => {
    const startMs = Date.now()
    const tempDir = app.getPath('temp')
    const ts = Date.now()
    const webmPath = join(tempDir, `transcribe-${ts}.webm`)
    const wavPath = join(tempDir, `transcribe-${ts}.wav`)

    try {
      writeFileSync(webmPath, Buffer.from(audioBuffer))

      // Convert webm to wav via ffmpeg (faster-whisper handles wav more reliably)
      const ffmpegResult = await new Promise<boolean>((resolve) => {
        const ff = spawn('ffmpeg', ['-y', '-i', webmPath, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', wavPath], { stdio: 'ignore' })
        ff.on('close', (code) => resolve(code === 0))
        ff.on('error', () => resolve(false))
      })

      const audioPath = ffmpegResult && existsSync(wavPath) ? wavPath : webmPath

      const binaryPath = getTranscriberPath()
      if (!existsSync(binaryPath)) {
        throw new Error(
          `Transcriber not found at ${binaryPath}. Run: cd python_backend && pyinstaller --onefile transcribe.py -n transcriber --distpath dist`
        )
      }

      const result = await new Promise<string>((resolve, reject) => {
        const proc = spawn(binaryPath, [audioPath], { stdio: ['ignore', 'pipe', 'pipe'] })

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        proc.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        proc.on('close', (code) => {
          if (code !== 0) {
            const out = stdout.trim()
            if (out) {
              try {
                const parsed = JSON.parse(out)
                if (parsed.error) {
                  reject(new Error(parsed.error))
                  return
                }
              } catch {
                /* stdout wasn't valid JSON */
              }
            }
            reject(new Error(stderr.trim() || out || `Process exited with code ${code}`))
            return
          }
          resolve(stdout)
        })
        proc.on('error', (err) => reject(err))
      })

      const parsed = JSON.parse(result.trim())
      if (parsed.error) {
        throw new Error(parsed.error)
      }
      trackEvent('transcription_used', { duration: Math.round((Date.now() - startMs) / 1000) })
      return parsed.text || ''
    } finally {
      for (const p of [webmPath, wavPath]) {
        if (existsSync(p)) {
          try {
            unlinkSync(p)
          } catch {
            /* ignore */
          }
        }
      }
    }
  })

  // AI Model Manager - check if GGUF model exists
  const AI_MODEL_FILENAME = 'Meta-Llama-3-8B-Instruct-Q4_K_M.gguf'
  const AI_MODEL_URL =
    'https://huggingface.co/lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct-Q4_K_M.gguf'

  ipcMain.handle('check-ai-status', () => {
    const modelsDir = join(app.getPath('userData'), 'models')
    const modelPath = join(modelsDir, AI_MODEL_FILENAME)
    return { ready: existsSync(modelPath) }
  })

  ipcMain.handle('download-ai-model', async () => {
    const modelsDir = join(app.getPath('userData'), 'models')
    if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true })
    const modelPath = join(modelsDir, AI_MODEL_FILENAME)
    if (existsSync(modelPath)) return { success: true }

    const res = await fetch(AI_MODEL_URL, { redirect: 'follow' })
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
    const contentLength = res.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

    const fileStream = createWriteStream(modelPath)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    let receivedBytes = 0

    const streamFinished = new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        fileStream.end()
        if (mainWindowRef) mainWindowRef.webContents.send('download-progress', 100)
        break
      }
      fileStream.write(Buffer.from(value))
      receivedBytes += value.length
      const percent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0
      if (mainWindowRef) mainWindowRef.webContents.send('download-progress', percent)
    }

    await streamFinished
    return { success: true }
  })

  // Summarize using node-llama-cpp (embedded GGUF model)
  ipcMain.handle('run-summary', async (_event, text: string) => {
    const modelsDir = join(app.getPath('userData'), 'models')
    const modelPath = join(modelsDir, AI_MODEL_FILENAME)
    if (!existsSync(modelPath)) {
      throw new Error('AI model not found. Download it first via the AI Summarize flow.')
    }

    const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
    const llama = await getLlama()
    const model = await llama.loadModel({ modelPath })
    const context = await model.createContext()
    const session = new LlamaChatSession({ contextSequence: context.getSequence() })

    const prompt = `Summarize this text concisely. Return only the summary, no preamble:\n\n${text}`
    const summary = await session.prompt(prompt)
    trackEvent('summary_used')
    return summary?.trim() ?? ''
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
