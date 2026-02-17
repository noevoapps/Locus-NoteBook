import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync, existsSync, readdirSync, readFileSync, mkdirSync, renameSync, rmSync, createWriteStream } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { privacyStore } from './store'
import * as Sentry from '@sentry/electron/main'
import { initialize as aptabaseInitialize, trackEvent as aptabaseTrackEvent } from '@aptabase/electron/main'
import { autoUpdater } from 'electron-updater'

const isWindows = process.platform === 'win32'

// Privacy-first crash reporting: only send if user opted in
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://95be6fe73d23d7158ed1ad18a8ab679a@o4510869943681024.ingest.us.sentry.io/4510869956657152',
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

  // --- Auto-updates via GitHub Releases ---
  try {
    // Do not download automatically; wait for user confirmation from the renderer.
    autoUpdater.autoDownload = false
    // Safe default: install on quit after download completes.
    autoUpdater.autoInstallOnAppQuit = true
  } catch (err) {
    console.error('Failed to configure autoUpdater:', err)
  }

  autoUpdater.on('error', (error) => {
    console.error('Auto-update error:', error)
    if (mainWindowRef) {
      const message =
        error instanceof Error ? error.message : error ? String(error) : 'Unknown update error'
      mainWindowRef.webContents.send('update-error', message)
    }
  })

  autoUpdater.on('update-available', (info) => {
    if (mainWindowRef) {
      mainWindowRef.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    if (mainWindowRef) {
      mainWindowRef.webContents.send('update-not-available')
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindowRef) {
      // progress.percent may be fractional; normalize to 0–100 integer.
      const percent = Math.round(progress.percent ?? 0)
      mainWindowRef.webContents.send('update-download-progress', percent)
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindowRef) {
      mainWindowRef.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null
      })
    }
  })

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      const info = result?.updateInfo
      return {
        success: true,
        updateInfo: info
          ? { version: info.version, releaseNotes: info.releaseNotes ?? null }
          : null
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('check-for-updates failed:', err)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('download-update failed:', err)
      return { success: false, error: message }
    }
  })

  ipcMain.handle('quit-and-install', () => {
    // This will close the app and install the downloaded update.
    autoUpdater.quitAndInstall()
    return true
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

  // Export embedded audio (e.g. data:audio/webm;base64,...) as WAV file via ffmpeg
  ipcMain.handle('export-audio-as-wav', async (_event, dataUrl: string) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:audio/')) {
      return { success: false, error: 'Not an audio data URL' }
    }
    const match = dataUrl.match(/^data:audio\/[^;]+;base64,(.+)$/)
    if (!match) return { success: false, error: 'Invalid audio data URL' }
    const tempDir = app.getPath('temp')
    const ts = Date.now()
    const webmPath = join(tempDir, `export-audio-${ts}.webm`)
    const wavPath = join(tempDir, `export-audio-${ts}.wav`)
    try {
      const buf = Buffer.from(match[1], 'base64')
      writeFileSync(webmPath, buf)
      const ffmpegOk = await new Promise<boolean>((resolve) => {
        const ff = spawn('ffmpeg', ['-y', '-i', webmPath, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', wavPath], {
          stdio: 'ignore'
        })
        ff.on('close', (code) => resolve(code === 0))
        ff.on('error', () => resolve(false))
      })
      if (!ffmpegOk || !existsSync(wavPath)) {
        return { success: false, error: 'Failed to convert audio to WAV' }
      }
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: 'recording.wav',
        filters: [{ name: 'WAV audio', extensions: ['wav'] }]
      })
      if (canceled || !filePath) return { success: false, canceled: true }
      const wavData = readFileSync(wavPath)
      writeFileSync(filePath, wavData)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
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

  // AI Model Manager - multiple GGUF models (sizeGb = approximate download size)
  const AI_MODELS: { id: string; name: string; filename: string; url: string; sizeGb: string }[] = [
    {
      id: 'llama-3-8b',
      name: 'Llama 3 8B Instruct',
      filename: 'Meta-Llama-3-8B-Instruct-Q4_K_M.gguf',
      url: 'https://huggingface.co/lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct-Q4_K_M.gguf',
      sizeGb: '4.9'
    },
    {
      id: 'mistral-7b',
      name: 'Mistral 7B Instruct',
      filename: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
      url: 'https://huggingface.co/lmstudio-community/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
      sizeGb: '4.4'
    },
    {
      id: 'qwen2.5-7b',
      name: 'Qwen2.5 7B Instruct',
      filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
      url: 'https://huggingface.co/lmstudio-community/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
      sizeGb: '4.7'
    }
  ]

  const SELECTED_AI_MODEL_KEY = 'selectedAiModelId'

  const getSelectedModelFilename = (): string => {
    const id = loadSettings()[SELECTED_AI_MODEL_KEY] as string | undefined
    const model = AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0]
    return model.filename
  }

  ipcMain.handle('list-ai-models', () => {
    const modelsDir = join(app.getPath('userData'), 'models')
    const downloaded = existsSync(modelsDir)
      ? readdirSync(modelsDir).filter((f) => f.endsWith('.gguf'))
      : []
    return {
      models: AI_MODELS.map((m) => ({ id: m.id, name: m.name, filename: m.filename, sizeGb: m.sizeGb })),
      downloaded
    }
  })

  ipcMain.handle('get-selected-ai-model', () => {
    const id = loadSettings()[SELECTED_AI_MODEL_KEY] as string | undefined
    const model = AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0]
    return { id: model.id, name: model.name, filename: model.filename, sizeGb: model.sizeGb }
  })

  ipcMain.handle('set-selected-ai-model', (_event, modelId: string) => {
    if (!AI_MODELS.some((m) => m.id === modelId)) return false
    const settings = loadSettings()
    settings[SELECTED_AI_MODEL_KEY] = modelId
    saveSettings(settings)
    return true
  })

  ipcMain.handle('check-ai-status', () => {
    const modelsDir = join(app.getPath('userData'), 'models')
    const filename = getSelectedModelFilename()
    const modelPath = join(modelsDir, filename)
    return { ready: existsSync(modelPath) }
  })

  ipcMain.handle('download-ai-model', async (_event, modelId: string) => {
    const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0]
    const modelsDir = join(app.getPath('userData'), 'models')
    if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true })
    const modelPath = join(modelsDir, model.filename)
    if (existsSync(modelPath)) return { success: true }

    const res = await fetch(model.url, { redirect: 'follow' })
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
  // Safe limits to prevent OOM/crash on long text: cap context size and input length
  const SUMMARY_CONTEXT_SIZE = 4096
  const SUMMARY_MAX_INPUT_CHARS = 12_000
  const SUMMARY_MAX_TOKENS = 1024

  // Extract plain text from BlockNote JSON (saved note content) for summarization
  const blockNoteContentToText = (contentJson: string): string => {
    try {
      const parsed = JSON.parse(contentJson)
      if (!Array.isArray(parsed)) return contentJson.trim()
      const blocks = parsed as Array<{ content?: string | Array<{ type?: string; text?: string }>; children?: unknown[] }>
      const parts: string[] = []
      for (const block of blocks) {
        if (block.content == null) continue
        if (typeof block.content === 'string') {
          parts.push(block.content)
          continue
        }
        if (Array.isArray(block.content)) {
          const text = block.content
            .map((c) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: string }).text) : ''))
            .join('')
          if (text) parts.push(text)
        }
      }
      return parts.length > 0 ? parts.join('\n\n') : contentJson.trim()
    } catch {
      return contentJson.trim()
    }
  }

  ipcMain.handle('run-summary', async (_event, payload: unknown) => {
    // --- DEBUG: what we received ---
    console.log('[run-summary] payload type:', typeof payload)
    if (payload != null && typeof payload === 'object') {
      const p = payload as Record<string, unknown>
      console.log('[run-summary] payload keys:', Object.keys(p))
      console.log('[run-summary] payload.text type:', typeof p.text, 'length:', typeof p.text === 'string' ? (p.text as string).length : 'N/A')
      console.log('[run-summary] payload.noteId:', p.noteId)
      console.log('[run-summary] payload.folderId:', p.folderId)
    }

    let textToSummarize = ''
    let source = 'none'
    if (payload != null && typeof payload === 'object' && 'text' in payload && typeof (payload as { text: unknown }).text === 'string') {
      textToSummarize = ((payload as { text: string }).text || '').trim()
      source = 'payload.text'
    }
    if (!textToSummarize && payload != null && typeof payload === 'object' && 'noteId' in payload) {
      const { noteId, folderId } = payload as { noteId?: string; folderId?: string }
      if (noteId) {
        const base = getNotesFolder()
        const dir = folderId ? join(base, folderId) : base
        const path = join(dir, `${noteId}.json`)
        if (existsSync(path)) {
          const note = JSON.parse(readFileSync(path, 'utf-8')) as { content?: string }
          if (note?.content) {
            textToSummarize = blockNoteContentToText(note.content).trim()
            source = 'disk'
          }
        }
      }
    }

    // Strip any remaining data: URLs (audio/image) so prompt is text-only
    textToSummarize = textToSummarize
      .replace(/\[\]\(data:audio\/[^)]+\)/g, '[Audio recording]')
      .replace(/\[\]\(data:image\/[^)]+\)/g, '[Image]')
      .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[Image]')
      .replace(/data:audio\/[^,\s)]+/g, '[Audio]')
      .replace(/data:image\/[^,\s)]+/g, '[Image]')

    console.log('[run-summary] textToSummarize source:', source, 'length:', textToSummarize.length)
    console.log('[run-summary] textToSummarize preview (first 400 chars):', JSON.stringify(textToSummarize.slice(0, 400)))
    console.log('[run-summary] textToSummarize preview (last 200 chars):', JSON.stringify(textToSummarize.slice(-200)))

    if (!textToSummarize) {
      throw new Error('No content to summarize. Add some text to your note first.')
    }

    const modelsDir = join(app.getPath('userData'), 'models')
    const filename = getSelectedModelFilename()
    const modelPath = join(modelsDir, filename)
    if (!existsSync(modelPath)) {
      throw new Error('AI model not found. Download it first via the AI Summarize flow.')
    }

    const trimmedForPrompt =
      textToSummarize.length > SUMMARY_MAX_INPUT_CHARS
        ? textToSummarize.slice(0, SUMMARY_MAX_INPUT_CHARS) + '\n\n[... text truncated for summary ...]'
        : textToSummarize

    const prompt = `Summarize this text and structure it with clear sections. Return ONLY valid Markdown, no preamble or explanation:
- Use "# " for the main title (one line).
- Use "## " for section headings.
- Use "### " for subheadings if needed.
- Use normal paragraphs under each heading.
- Use blank lines between paragraphs and after headings.

Text to summarize:

${trimmedForPrompt}`

    console.log('[run-summary] prompt length:', prompt.length)
    console.log('[run-summary] --- FULL PROMPT SENT TO MODEL ---')
    console.log(prompt)
    console.log('[run-summary] --- END FULL PROMPT ---')

    const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
    const llama = await getLlama()
    const model = await llama.loadModel({ modelPath })
    let context: Awaited<ReturnType<typeof model.createContext>> | null = null
    let session: InstanceType<typeof LlamaChatSession> | null = null

    try {
      context = await model.createContext({
        contextSize: SUMMARY_CONTEXT_SIZE
      })
      session = new LlamaChatSession({ contextSequence: context.getSequence() })

      const summary = await session.prompt(prompt, { maxTokens: SUMMARY_MAX_TOKENS })
      trackEvent('summary_used')
      return summary?.trim() ?? ''
    } finally {
      try {
        if (session && !session.disposed) session.dispose()
      } catch {
        /* ignore */
      }
      try {
        if (context && !context.disposed) await context.dispose()
      } catch {
        /* ignore */
      }
      try {
        if (model && !model.disposed) await model.dispose()
      } catch {
        /* ignore */
      }
    }
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
