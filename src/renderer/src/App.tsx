import { useCallback, useState, useEffect, useRef } from 'react'
import { MantineProvider, Menu, Modal, TextInput } from '@mantine/core'
import { createReactBlockSpec, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { BlockNoteSchema, createCodeBlockSpec, selectedFragmentToHTML } from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { AllSelection } from 'prosemirror-state'
import '@blocknote/mantine/style.css'
import { useAudioRecorder } from './hooks/useAudioRecorder'
import { AiDownloadModal } from './components/AiDownloadModal'
import { SettingsModal } from './components/SettingsModal'
import { useTheme } from './hooks/useTheme'
import {
  Mic,
  Square,
  Sparkles,
  MoreVertical,
  Save,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Download,
  FolderPlus,
  FileText,
  Pencil,
  Trash2,
  Scissors,
  Copy,
  ClipboardPaste,
  ClipboardType,
  SquareDashed,
  X,
  Plus,
  Palette,
  Image,
  Folder,
  FolderOpen,
  FolderArchive,
  FolderCode,
  FolderHeart,
  FolderKey,
  FolderLock,
  File,
  Bookmark,
  BookOpen,
  Book,
  Home,
  Building2,
  Briefcase,
  Target,
  Star,
  Zap,
  Music,
  Camera,
  Heart,
  Gift,
  Mail,
  Archive,
  Package,
  Calendar,
  Tag,
  Lightbulb,
  GraduationCap,
  Trophy,
  Flag,
  Pipette,
  Settings,
  Loader2,
  type LucideIcon
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import appIcon from './assets/icon.png'

type NoteMeta = { id: string; title: string; updatedAt: number }

/** Format release notes for display: strip HTML and support string or array from GitHub. */
function formatReleaseNotes(notes: unknown): string {
  const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (typeof notes === 'string') return strip(notes)
  if (Array.isArray(notes)) {
    return notes
      .map((n) => (typeof n === 'string' ? strip(n) : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}
type FolderMetadata = { icon: string; color: string }
type NotesData = {
  folders: string[]
  rootNotes: NoteMeta[]
  folderNotes: Record<string, NoteMeta[]>
  folderMetadata?: Record<string, FolderMetadata>
}
type OpenTab = { id: string; folderId?: string; title: string }

const FOLDER_ICON_NAMES = [
  'Folder', 'FolderOpen', 'FolderPlus', 'FolderArchive', 'FolderCode', 'FolderHeart', 'FolderKey', 'FolderLock',
  'FileText', 'File', 'Bookmark', 'BookOpen', 'Book', 'Home', 'Building2', 'Briefcase',
  'Target', 'Star', 'Sparkles', 'Zap', 'Music', 'Palette', 'Camera', 'Image',
  'Heart', 'Gift', 'Mail', 'Archive', 'Package', 'Calendar', 'Tag', 'Lightbulb',
  'GraduationCap', 'Trophy', 'Flag'
] as const

const FOLDER_ICON_MAP: Record<string, LucideIcon> = {
  Folder, FolderOpen, FolderPlus, FolderArchive, FolderCode, FolderHeart, FolderKey, FolderLock,
  FileText, File, Bookmark, BookOpen, Book, Home, Building2, Briefcase,
  Target, Star, Sparkles, Zap, Music, Palette, Camera, Image,
  Heart, Gift, Mail, Archive, Package, Calendar, Tag, Lightbulb,
  GraduationCap, Trophy, Flag
}

const DEFAULT_FOLDER_ICON = 'Folder'

function FolderIconDisplay({ iconName, color }: { iconName: string; color: string }) {
  const IconComponent = FOLDER_ICON_MAP[iconName] ?? FOLDER_ICON_MAP[DEFAULT_FOLDER_ICON]
  return IconComponent ? <IconComponent className="w-4 h-4 flex-shrink-0" style={{ color }} /> : null
}

// Color picker utilities (hex ↔ HSV ↔ RGB)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace(/^#/, '').match(/.{2}/g)
  if (!m) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) }
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
}
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
  }
  return { h: h * 360, s: s * 100, v: v * 100 }
}
function hsvToHex(h: number, s: number, v: number): string {
  s /= 100
  v /= 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

const DEFAULT_ICON_COLOR = '#e8b840'

function FolderColorPicker({
  color,
  defaultColor,
  onChange,
  onSave,
  onReset
}: {
  color: string
  defaultColor: string
  onChange: (hex: string) => void
  onSave: () => void
  onReset: () => void
}) {
  const [localColor, setLocalColor] = useState(color)
  const [rgbInputs, setRgbInputs] = useState(() => hexToRgb(color))
  const satRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef<'sat' | 'hue' | null>(null)

  const hsv = hexToHsv(localColor)

  useEffect(() => {
    setLocalColor(color)
    setRgbInputs(hexToRgb(color))
  }, [color])

  const updateFromHsv = useCallback((h: number, s: number, v: number) => {
    const hex = hsvToHex(h, s, v)
    setLocalColor(hex)
    setRgbInputs(hexToRgb(hex))
    onChange(hex)
  }, [onChange])

  const updateFromRgb = useCallback((r: number, g: number, b: number) => {
    const hex = rgbToHex(r, g, b)
    setLocalColor(hex)
    setRgbInputs({ r, g, b })
    onChange(hex)
  }, [onChange])

  const handleSatPointer = useCallback((e: React.MouseEvent | MouseEvent, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const s = x * 100
    const v = (1 - y) * 100
    updateFromHsv(hsv.h, s, v)
  }, [hsv.h, updateFromHsv])

  const handleHuePointer = useCallback((e: React.MouseEvent | MouseEvent, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const h = x * 360
    updateFromHsv(h, hsv.s, hsv.v)
  }, [hsv.s, hsv.v, updateFromHsv])

  useEffect(() => {
    const up = () => { isDragging.current = null }
    const move = (e: MouseEvent) => {
      if (isDragging.current === 'sat' && satRef.current) handleSatPointer(e, satRef.current)
      if (isDragging.current === 'hue' && hueRef.current) handleHuePointer(e, hueRef.current)
    }
    window.addEventListener('mouseup', up)
    window.addEventListener('mousemove', move)
    return () => {
      window.removeEventListener('mouseup', up)
      window.removeEventListener('mousemove', move)
    }
  }, [handleSatPointer, handleHuePointer])

  const pickFromScreen = useCallback(async () => {
    if (!('EyeDropper' in window)) return
    try {
      const dropper = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper()
      const { sRGBHex } = await dropper.open()
      const { r, g, b } = hexToRgb(sRGBHex)
      updateFromRgb(r, g, b)
    } catch {
      /* user cancelled or API failed */
    }
  }, [updateFromRgb])

  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

  return (
    <div className="space-y-4">
      <p className="text-foreground text-sm">Select a color for this icon</p>
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex-1 h-10 rounded-lg border border-border overflow-hidden"
          style={{
            background: `linear-gradient(to right, ${localColor}88, ${localColor})`,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
          }}
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setLocalColor(defaultColor)
              setRgbInputs(hexToRgb(defaultColor))
              onReset()
            }}
            className="px-4 py-2 rounded-lg bg-[#2e2b26] hover:bg-[#423d33] text-foreground text-sm font-medium shadow-md transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-lg bg-[#2e2b26] hover:bg-[#423d33] text-foreground text-sm font-medium shadow-md transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
      <div className="rounded-xl p-4 bg-[#2e2b26] border border-border shadow-inner">
        <div className="flex gap-3 items-start">
          <div
            ref={satRef}
            className="relative w-48 h-48 rounded-lg overflow-hidden cursor-crosshair flex-shrink-0 select-none"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv.h, 100, 100)})`
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              isDragging.current = 'sat'
              handleSatPointer(e, satRef.current!)
            }}
          >
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                backgroundColor: localColor
              }}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              {hasEyeDropper && (
                <button
                  onClick={pickFromScreen}
                  className="p-2 rounded-lg bg-[#27241f] hover:bg-[#423d33] text-muted hover:text-foreground transition-colors"
                  title="Pick color from screen"
                >
                  <Pipette className="w-4 h-4" />
                </button>
              )}
              <div
                className="w-10 h-10 rounded-lg border-2 border-border flex-shrink-0"
                style={{ backgroundColor: localColor }}
              />
              <div className="flex-1 min-h-[20px] flex items-center">
                <div
                  ref={hueRef}
                  className="relative w-full h-3 rounded-full cursor-crosshair select-none flex-shrink-0"
                  style={{
                    background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    isDragging.current = 'hue'
                    handleHuePointer(e, hueRef.current!)
                  }}
                >
                  <div
                    className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{
                      left: `${(hsv.h / 360) * 100}%`,
                      top: '50%',
                      backgroundColor: hsvToHex(hsv.h, 100, 100)
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['r', 'g', 'b'] as const).map((ch) => (
                <div key={ch}>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={rgbInputs[ch]}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) || 0
                      const next = { ...rgbInputs, [ch]: Math.max(0, Math.min(255, v)) }
                      setRgbInputs(next)
                      updateFromRgb(next.r, next.g, next.b)
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#27241f] border border-border text-foreground text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <label className="block text-xs text-muted mt-0.5 uppercase">{ch}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function tabKey(tab: OpenTab): string {
  return tab.folderId ? `${tab.folderId}/${tab.id}` : tab.id
}

function cn(...inputs: (string | false | null | undefined)[]) {
  return twMerge(clsx(inputs))
}

async function runSummary(payload: { text: string; noteId?: string; folderId?: string }): Promise<string> {
  if (window.api?.runSummary) {
    return window.api.runSummary(payload)
  }
  if (window.electron?.ipcRenderer?.invoke) {
    return window.electron.ipcRenderer.invoke('run-summary', payload)
  }
  throw new Error('AI summary not available')
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString()
}

/** Custom block shown while transcription is in progress; replaced by a paragraph when done. */
const createTranscribingPlaceholder = createReactBlockSpec(
  {
    type: 'transcribingPlaceholder',
    content: 'none',
    propSchema: {}
  },
  {
    render: () => (
      <div
        className="flex items-center gap-2 py-3 px-4 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-medium"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" aria-hidden />
        <span>Transcribing...</span>
      </div>
    )
  }
)

function logToMain(level: 'debug' | 'info' | 'warn' | 'error', message: string, detail?: unknown): void {
  try {
    window.api?.logToMain?.(level, message, detail)
  } catch {
    /* ignore */
  }
}

export default function App(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notesData, setNotesData] = useState<NotesData>({ folders: [], rootNotes: [], folderNotes: {} })
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const selectedNoteId = openTabs[activeTabIndex]?.id ?? null
  const selectedFolderId = openTabs[activeTabIndex]?.folderId
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('Untitled Note')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [folderModal, setFolderModal] = useState<'create' | 'rename' | null>(null)
  const [folderModalName, setFolderModalName] = useState('')
  const [folderModalTarget, setFolderModalTarget] = useState<string | null>(null)
  const [folderIconModal, setFolderIconModal] = useState<string | null>(null)
  const [folderColorModal, setFolderColorModal] = useState<string | null>(null)
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [noteContextMenu, setNoteContextMenu] = useState<{ id: string; folderId?: string; x: number; y: number } | null>(null)
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<{ id: string; folderId?: string } | null>(null)
  const [aiDownloadModalOpen, setAiDownloadModalOpen] = useState(false)
  const [aiDownloadModalContext, setAiDownloadModalContext] = useState<'summarize' | { modelId: string; modelName: string } | null>(null)
  const [aiModelsList, setAiModelsList] = useState<{
    models: { id: string; name: string; filename: string; sizeGb: string }[]
    downloaded: string[]
  } | null>(null)
  const [selectedAiModel, setSelectedAiModel] = useState<{ id: string; name: string; filename: string; sizeGb: string } | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const aiModelDropdownRef = useRef<HTMLDivElement>(null)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [transcribeStatus, setTranscribeStatus] = useState<{
    type: 'transcribing' | 'success' | 'error'
    message?: string
  } | null>(null)
  const transcribeStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorContextMenu, setEditorContextMenu] = useState<{
    x: number
    y: number
    audioUrl?: string
    audioBlockId?: string
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const noteContextMenuRef = useRef<HTMLDivElement>(null)
  const editorContextMenuRef = useRef<HTMLDivElement>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const codeBlockSelectInteractingRef = useRef(false)
  const scheduleCodeBlockLineNumbersRef = useRef<(() => void) | null>(null)
  const isMountedRef = useRef(true)
  const currentNoteIdRef = useRef<string | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [updateReleaseNotes, setUpdateReleaseNotes] = useState<unknown | null>(null)
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  >('idle')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const { theme, themeId } = useTheme()

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (transcribeStatusTimeoutRef.current) {
        clearTimeout(transcribeStatusTimeoutRef.current)
        transcribeStatusTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    currentNoteIdRef.current = selectedNoteId
  }, [selectedNoteId])

  // Clear transcribe status after a delay
  const setTranscribeStatusWithAutoClear = useCallback(
    (status: { type: 'transcribing' | 'success' | 'error'; message?: string } | null, clearMs?: number) => {
      if (transcribeStatusTimeoutRef.current) {
        clearTimeout(transcribeStatusTimeoutRef.current)
        transcribeStatusTimeoutRef.current = null
      }
      setTranscribeStatus(status)
      if (status && status.type !== 'transcribing' && clearMs != null) {
        transcribeStatusTimeoutRef.current = setTimeout(() => {
          transcribeStatusTimeoutRef.current = null
          setTranscribeStatus(null)
        }, clearMs)
      }
    },
    []
  )

  // Clear pending auto-save when switching notes so we don't save the wrong note
  useEffect(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }
  }, [selectedNoteId, selectedFolderId])

  // Auto-update: subscribe to update events from main process and trigger a check on startup.
  useEffect(() => {
    if (!window.api) return

    const unsubAvailable = window.api.onUpdateAvailable?.((info) => {
      setUpdateVersion(info.version)
      setUpdateReleaseNotes(info.releaseNotes ?? null)
      setUpdateStatus('available')
      setUpdateModalOpen(true)
    })
    const unsubDownloaded = window.api.onUpdateDownloaded?.((info) => {
      setUpdateVersion(info.version)
      setUpdateReleaseNotes(info.releaseNotes ?? null)
      setUpdateStatus('downloaded')
      setUpdateModalOpen(true)
    })
    const unsubProgress = window.api.onUpdateDownloadProgress?.((percent) => {
      setUpdateProgress(percent)
      setUpdateStatus('downloading')
    })
    const unsubError = window.api.onUpdateError?.((message) => {
      setUpdateError(message)
      setUpdateStatus('error')
      setUpdateModalOpen(true)
    })

    // Kick off a background check shortly after startup.
    setUpdateStatus('checking')
    window.api
      .checkForUpdates()
      .then((result) => {
        if (!result?.success) {
          if (result?.error) {
            setUpdateError(result.error)
            setUpdateStatus('error')
          } else {
            setUpdateStatus('idle')
          }
          return
        }
        if (result.updateInfo) {
          setUpdateVersion(result.updateInfo.version)
          setUpdateReleaseNotes(result.updateInfo.releaseNotes ?? null)
          setUpdateStatus('available')
          setUpdateModalOpen(true)
        } else {
          setUpdateStatus('idle')
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        setUpdateError(message)
        setUpdateStatus('error')
      })

    return () => {
      unsubAvailable?.()
      unsubDownloaded?.()
      unsubProgress?.()
      unsubError?.()
    }
  }, [])

  const uploadFile = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }, [])

  const blockNoteTheme = theme?.blockNote ?? {
    colors: {
      editor: { text: '#d7c097', background: '#2a241d' },
      menu: { text: '#d7c097', background: '#2e2b26' },
      tooltip: { text: '#27241f', background: '#e8b840' },
      hovered: { text: '#d7c097', background: '#423d33' },
      selected: { text: '#d7c097', background: '#4d9cbc33' },
      disabled: { text: '#767069', background: '#2e2b26' }
    },
    fontFamily: 'Karla, sans-serif'
  }

  const editor = useCreateBlockNote({
    uploadFile,
    schema: BlockNoteSchema.create().extend({
      blockSpecs: {
        codeBlock: createCodeBlockSpec(codeBlockOptions),
        transcribingPlaceholder: createTranscribingPlaceholder()
      }
    })
  })

  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isRecording,
    isPaused,
    recordingTime,
    blobToArrayBuffer
  } = useAudioRecorder()

  const loadNotes = useCallback(async () => {
    try {
      const data = await window.electron?.ipcRenderer?.invoke('notes-list')
      if (data) {
        setNotesData({
          folders: data.folders ?? [],
          rootNotes: data.rootNotes ?? [],
          folderNotes: data.folderNotes ?? {},
          folderMetadata: data.folderMetadata ?? {}
        })
      }
    } catch (err) {
      console.error('loadNotes failed:', err)
    }
  }, [])

  useEffect(() => {
    if (openTabs.length > 0 && notesData.rootNotes.length + Object.values(notesData.folderNotes).flat().length > 0) {
      setOpenTabs((prev) =>
        prev.map((tab, i) => {
          if (i === activeTabIndex) return tab
          const meta = tab.folderId
            ? notesData.folderNotes[tab.folderId]?.find((n) => n.id === tab.id)
            : notesData.rootNotes.find((n) => n.id === tab.id)
          return meta ? { ...tab, title: meta.title } : tab
        })
      )
    }
  }, [notesData, activeTabIndex])

  useEffect(() => {
    loadNotes()
  }, [])

  useEffect(() => {
    const hasNotes = notesData.rootNotes.length > 0 || Object.values(notesData.folderNotes ?? {}).some((n) => Array.isArray(n) && n.length > 0)
    if (openTabs.length === 0 && hasNotes) {
      const firstNote = notesData.rootNotes[0] ?? Object.values(notesData.folderNotes ?? {}).flat().find(Boolean)
      if (firstNote) {
        const inRoot = notesData.rootNotes.some((n) => n.id === firstNote.id)
        const folderId = inRoot ? undefined : Object.keys(notesData.folderNotes ?? {}).find((f) => notesData.folderNotes?.[f]?.some((n) => n.id === firstNote.id))
        setOpenTabs([{ id: firstNote.id, folderId, title: firstNote.title }])
        setActiveTabIndex(0)
      }
    }
  }, [notesData, openTabs.length])

  const loadAiModelsAndSelected = useCallback(async () => {
    try {
      const list = await window.api?.listAiModels?.()
      const selected = await window.api?.getSelectedAiModel?.()
      if (list) setAiModelsList(list)
      if (selected) setSelectedAiModel(selected)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadAiModelsAndSelected()
  }, [loadAiModelsAndSelected])

  useEffect(() => {
    if (!aiDownloadModalOpen) loadAiModelsAndSelected()
  }, [aiDownloadModalOpen, loadAiModelsAndSelected])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuPos && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null)
        setFolderMenuOpen(null)
      }
      if (noteContextMenu && noteContextMenuRef.current && !noteContextMenuRef.current.contains(e.target as Node)) {
        setNoteContextMenu(null)
      }
      if (editorContextMenu && editorContextMenuRef.current && !editorContextMenuRef.current.contains(e.target as Node)) {
        setEditorContextMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [contextMenuPos, noteContextMenu, editorContextMenu])

  const loadNoteContent = useCallback(
    async (id: string, folderId?: string) => {
      try {
        const data = await window.electron.ipcRenderer.invoke('notes-load', id, folderId)
        if (!data) return

        if (isMountedRef.current) {
          setTitle(data.title || 'Untitled Note')
        }

        // BlockNote/TipTap can throw if we update content before the view mounts.
        const apply = () => {
          if (!editor) return false
          if (settingsModalOpen) return false
          try {
            let blocks: Parameters<typeof editor.replaceBlocks>[1]
            if (data.content) {
              const trimmed = data.content.trim()
              if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                  blocks = JSON.parse(data.content) as Parameters<typeof editor.replaceBlocks>[1]
                } catch {
                  blocks = editor.tryParseMarkdownToBlocks(data.content)
                }
              } else {
                blocks = editor.tryParseMarkdownToBlocks(data.content)
              }
            } else {
              blocks = []
            }
            editor.replaceBlocks(editor.document, blocks)
            return true
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            if (msg.includes('domAtPos') || msg.includes('editor view is not available')) return false
            logToMain('warn', 'loadNoteContent apply() failed', { message: msg, noteId: id })
            throw e
          }
        }

        for (let i = 0; i < 30 && isMountedRef.current; i++) {
          if (apply()) return
          await new Promise((r) => setTimeout(r, 50))
        }
        logToMain('warn', 'loadNoteContent timed out after retries', { noteId: id })
      } catch (err) {
        logToMain('error', 'loadNoteContent failed', err instanceof Error ? { message: err.message, stack: err.stack } : err)
        throw err
      }
    },
    [editor, settingsModalOpen]
  )

  const openOrSwitchToTab = useCallback(
    (id: string, folderId?: string, noteTitle?: string) => {
      const existingIdx = openTabs.findIndex((t) => t.id === id && t.folderId === folderId)
      if (existingIdx >= 0) {
        setActiveTabIndex(existingIdx)
        return
      }
      const meta = folderId
        ? notesData.folderNotes[folderId]?.find((n) => n.id === id)
        : notesData.rootNotes.find((n) => n.id === id)
      const tabTitle = noteTitle ?? meta?.title ?? 'Untitled Note'
      setOpenTabs((prev) => [...prev, { id, folderId, title: tabTitle }])
      setActiveTabIndex(openTabs.length)
    },
    [openTabs, notesData]
  )

  const switchToTab = useCallback(
    (index: number) => {
      if (index === activeTabIndex) return
      setActiveTabIndex(index)
    },
    [activeTabIndex]
  )

  const closeTab = useCallback(
    (index: number) => {
      const tab = openTabs[index]
      if (!tab) return
      const newTabs = openTabs.filter((_, i) => i !== index)
      setOpenTabs(newTabs)
      if (newTabs.length === 0) return
      let newIndex: number
      if (index === activeTabIndex) {
        newIndex = activeTabIndex > 0 ? activeTabIndex - 1 : 0
      } else if (index < activeTabIndex) {
        newIndex = activeTabIndex - 1
      } else {
        newIndex = activeTabIndex
      }
      setActiveTabIndex(newIndex)
    },
    [openTabs, activeTabIndex]
  )

  useEffect(() => {
    if (!selectedNoteId) return
    loadNoteContent(selectedNoteId, selectedFolderId).catch((err) => {
      logToMain('error', 'loadNoteContent effect failed', err instanceof Error ? { message: err.message, stack: err.stack } : err)
    })
  }, [selectedNoteId, selectedFolderId, loadNoteContent])

  // Add line numbers to code blocks (debounced to avoid freezing when typing)
  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return

    const LINE_NUMBERS_CLASS = 'locus-line-numbers'
    const DEBOUNCE_MS = 200

    function updateCodeBlockLineNumbers(block: Element) {
      const pre = block.querySelector(':scope > pre')
      const code = pre?.querySelector('code')
      if (!pre || !code) return

      let gutter = block.querySelector(`.${LINE_NUMBERS_CLASS}`)
      const text = (code.textContent || '')
      const lineCount = Math.max(1, (text.match(/\n/g) || []).length + 1)
      const numbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')

      if (!gutter) {
        gutter = document.createElement('div')
        gutter.className = LINE_NUMBERS_CLASS
        gutter.setAttribute('aria-hidden', 'true')
        block.insertBefore(gutter, pre)
      }
      if (gutter.textContent !== numbers) gutter.textContent = numbers
    }

    function processAllCodeBlocks() {
      if (!container) return
      if (codeBlockSelectInteractingRef.current) return
      if (document.activeElement?.tagName === 'SELECT' && document.activeElement.closest('.bn-block-content[data-content-type="codeBlock"]')) {
        return
      }
      container.querySelectorAll('.bn-block-content[data-content-type="codeBlock"]').forEach(updateCodeBlockLineNumbers)
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleProcessAllCodeBlocks() {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        requestAnimationFrame(processAllCodeBlocks)
      }, DEBOUNCE_MS)
    }

    let observer: MutationObserver | null = null

    function startObserving() {
      if (!container) return
      if (observer) return
      observer = new MutationObserver(scheduleProcessAllCodeBlocks)
      observer.observe(container, { childList: true, subtree: true })
    }

    function stopObserving() {
      if (observer) {
        observer.disconnect()
        observer = null
      }
    }

    function onCodeBlockSelectInteraction() {
      codeBlockSelectInteractingRef.current = true
      stopObserving()
      const clear = () => {
        codeBlockSelectInteractingRef.current = false
        startObserving()
      }
      setTimeout(clear, 2500)
    }

    processAllCodeBlocks()
    scheduleCodeBlockLineNumbersRef.current = scheduleProcessAllCodeBlocks
    startObserving()

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('.bn-block-content[data-content-type="codeBlock"]') && (target.tagName === 'SELECT' || target.closest('select'))) {
        onCodeBlockSelectInteraction()
      }
    }
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element
      if (target.tagName === 'SELECT' && target.closest('.bn-block-content[data-content-type="codeBlock"]')) {
        onCodeBlockSelectInteraction()
      }
    }
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as Element
      if (target.tagName === 'SELECT' && target.closest('.bn-block-content[data-content-type="codeBlock"]')) {
        setTimeout(() => {
          if (document.activeElement?.tagName !== 'SELECT') {
            codeBlockSelectInteractingRef.current = false
            startObserving()
          }
        }, 300)
      }
    }

    container.addEventListener('mousedown', handleMouseDown, true)
    container.addEventListener('focusin', handleFocusIn, true)
    container.addEventListener('focusout', handleFocusOut, true)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      scheduleCodeBlockLineNumbersRef.current = null
      stopObserving()
      container.removeEventListener('mousedown', handleMouseDown, true)
      container.removeEventListener('focusin', handleFocusIn, true)
      container.removeEventListener('focusout', handleFocusOut, true)
    }
  }, [editor])

  useEffect(() => {
    if (openTabs.length > 0 && activeTabIndex < openTabs.length) {
      setOpenTabs((prev) =>
        prev.map((tab, i) => (i === activeTabIndex ? { ...tab, title } : tab))
      )
    }
  }, [title])

  const saveCurrentNote = useCallback(async () => {
    if (!selectedNoteId || !editor) return
    setIsSaving(true)
    setSavedIndicator(false)
    try {
      const content = JSON.stringify(editor.document)
      await window.electron.ipcRenderer.invoke('notes-save', {
        id: selectedNoteId,
        title,
        content,
        folderId: selectedFolderId
      })
      await loadNotes()
      setSavedIndicator(true)
      setTimeout(() => setSavedIndicator(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }, [selectedNoteId, selectedFolderId, title, editor, loadNotes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveCurrentNote()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveCurrentNote])

  const AUTO_SAVE_DELAY_MS = 7000
  const handleEditorChange = useCallback(() => {
    if (!selectedNoteId || !editor) return
    scheduleCodeBlockLineNumbersRef.current?.()
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null
      saveCurrentNote()
    }, AUTO_SAVE_DELAY_MS)
  }, [selectedNoteId, editor, saveCurrentNote])

  const createNewNote = useCallback(
    async (folderId?: string) => {
      if (selectedNoteId && editor) {
        const content = JSON.stringify(editor.document)
        await window.electron.ipcRenderer.invoke('notes-save', {
          id: selectedNoteId,
          title,
          content,
          folderId: selectedFolderId
        })
      }
      const created = await window.electron.ipcRenderer.invoke('notes-create', folderId)
      await loadNotes()
      const newTab: OpenTab = { id: created.id, folderId: created.folderId, title: 'Untitled Note' }
      setOpenTabs((prev) => [...prev, newTab])
      setActiveTabIndex(openTabs.length)
      if (editor) {
        editor.replaceBlocks(editor.document, [])
        // Save the new note immediately so it exists on disk with proper BlockNote format
        const content = JSON.stringify(editor.document)
        await window.electron.ipcRenderer.invoke('notes-save', {
          id: created.id,
          title: 'Untitled Note',
          content,
          folderId: created.folderId
        })
        await loadNotes()
      }
    },
    [selectedNoteId, selectedFolderId, title, editor, loadNotes, openTabs.length]
  )

  const createFolder = useCallback(async () => {
    const name = folderModalName.trim()
    if (!name) return
    try {
      await window.electron.ipcRenderer.invoke('folder-create', name)
      setFolderModal(null)
      setFolderModalName('')
      await loadNotes()
    } catch (err) {
      console.error(err)
    }
  }, [folderModalName, loadNotes])

  const renameFolder = useCallback(async () => {
    const newName = folderModalName.trim()
    if (!newName || !folderModalTarget) return
    try {
      await window.electron.ipcRenderer.invoke('folder-rename', folderModalTarget, newName)
      setFolderModal(null)
      setFolderModalName('')
      setFolderModalTarget(null)
      setOpenTabs((prev) =>
        prev.map((t) => (t.folderId === folderModalTarget ? { ...t, folderId: newName } : t))
      )
      await loadNotes()
    } catch (err) {
      console.error(err)
    }
  }, [folderModalName, folderModalTarget, loadNotes])

  const setFolderMetadata = useCallback(
    async (name: string, metadata: { icon?: string; color?: string }) => {
      try {
        await window.electron.ipcRenderer.invoke('folder-metadata-set', name, metadata)
        await loadNotes()
      } catch (err) {
        console.error(err)
      }
    },
    [loadNotes]
  )

  const deleteFolder = useCallback(
    async (name: string) => {
      try {
        await window.electron.ipcRenderer.invoke('folder-delete', name)
        const activeTab = openTabs[activeTabIndex]
        const newTabs = openTabs.filter((t) => t.folderId !== name)
        setOpenTabs(newTabs)
        if (newTabs.length === 0) {
          setActiveTabIndex(0)
        } else if (activeTab?.folderId === name) {
          setActiveTabIndex(0)
        } else {
          const idx = newTabs.findIndex((t) => t.id === activeTab?.id && t.folderId === activeTab?.folderId)
          setActiveTabIndex(idx >= 0 ? idx : 0)
        }
        await loadNotes()
      } catch (err) {
        console.error(err)
      }
    },
    [openTabs, activeTabIndex, loadNotes]
  )

  const deleteNote = useCallback(
    async (id: string, folderId?: string) => {
      try {
        await window.electron.ipcRenderer.invoke('notes-delete', id, folderId)
        const tabIdx = openTabs.findIndex((t) => t.id === id && t.folderId === folderId)
        if (tabIdx >= 0) {
          const newTabs = openTabs.filter((t) => !(t.id === id && t.folderId === folderId))
          setOpenTabs(newTabs)
          if (newTabs.length > 0) {
            const newIndex = tabIdx >= newTabs.length ? newTabs.length - 1 : (tabIdx > 0 ? tabIdx - 1 : 0)
            setActiveTabIndex(newIndex)
          }
        }
        setDeleteNoteTarget(null)
        await loadNotes()
      } catch (err) {
        console.error(err)
      }
    },
    [openTabs, loadNotes]
  )

  const toggleFolder = (name: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const blobToDataUrl = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  }, [])

  /** Decode a data URL (e.g. data:audio/webm;base64,...) to ArrayBuffer. Works for large payloads where fetch() may fail. */
  const dataUrlToArrayBuffer = useCallback((dataUrl: string): ArrayBuffer => {
    const comma = dataUrl.indexOf(',')
    if (comma === -1) throw new Error('Invalid data URL')
    const base64 = dataUrl.slice(comma + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
  }, [])

  /** Single entry point for transcription; uses exposed api.transcribe when available. */
  const transcribeAudio = useCallback((buffer: ArrayBuffer): Promise<string> => {
    if (typeof window.api?.transcribe === 'function') return window.api.transcribe(buffer)
    if (typeof (window as unknown as { electron?: { ipcRenderer?: { invoke: (c: string, b: ArrayBuffer) => Promise<string> } } }).electron?.ipcRenderer?.invoke === 'function') {
      return (window as unknown as { electron: { ipcRenderer: { invoke: (c: string, b: ArrayBuffer) => Promise<string> } } }).electron.ipcRenderer.invoke('transcribe-audio', buffer)
    }
    return Promise.reject(new Error('Transcription not available'))
  }, [])

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      try {
        setIsTranscribing(true)
        setTranscribeStatusWithAutoClear({ type: 'transcribing' })
        const blob = await stopRecording()
        if (!editor) {
          setIsTranscribing(false)
          setTranscribeStatusWithAutoClear(null)
          return
        }

        const noteIdAtStart = selectedNoteId
        const failureMessageBase = 'Transcription failed. Right-click the audio and choose Transcribe to retry.'
        const failureMessageWithReason = (reason: unknown) => {
          const raw = reason instanceof Error ? reason.message : String(reason ?? '')
          const msg = raw.trim()
          if (!msg) return failureMessageBase
          const clipped = msg.length > 160 ? `${msg.slice(0, 160)}…` : msg
          return `Transcription failed: ${clipped}. Right-click the audio and choose Transcribe to retry.`
        }

        const dataUrl = await blobToDataUrl(blob)
        const doc = editor.document
        const refBlock = doc[doc.length - 1]
        const audioBlock = { type: 'audio' as const, props: { url: dataUrl, name: 'Recording' } }
        const transcribingBlock = { type: 'transcribingPlaceholder' as const, props: {} }

        let placeholderId: string

        if (refBlock) {
          const inserted = editor.insertBlocks([audioBlock, transcribingBlock], refBlock, 'after')
          const second = inserted?.[1]
          placeholderId = (second && typeof second === 'object' && 'id' in second ? second.id : undefined) ?? ''
          if (!placeholderId) {
            const lastBlock = editor.document[editor.document.length - 1]
            if (lastBlock?.type === 'transcribingPlaceholder') placeholderId = lastBlock.id
          }
        } else {
          editor.replaceBlocks(editor.document, [audioBlock, transcribingBlock])
          const lastBlock = editor.document[editor.document.length - 1]
          placeholderId = lastBlock?.type === 'transcribingPlaceholder' ? lastBlock.id : (lastBlock?.id ?? '')
        }

        blobToArrayBuffer(blob)
          .then((buffer) => transcribeAudio(buffer))
          .then((text) => {
            if (currentNoteIdRef.current !== noteIdAtStart || !editor) return
            if (!placeholderId) return
            try {
              const block = editor.getBlock(placeholderId)
              if (block) {
                if (text && text.trim()) {
                  editor.replaceBlocks([block], [{ type: 'paragraph', content: text.trim() }])
                  setTranscribeStatusWithAutoClear({ type: 'success' }, 3000)
                } else {
                  editor.replaceBlocks([block], [{ type: 'paragraph', content: failureMessageBase }])
                  setTranscribeStatusWithAutoClear({ type: 'error', message: 'No text returned' }, 5000)
                }
              }
            } catch {
              /* block may have been removed or document changed */
            }
          })
          .catch((err) => {
            console.error('Auto-transcription failed:', err)
            if (currentNoteIdRef.current === noteIdAtStart && editor && placeholderId) {
              try {
                const block = editor.getBlock(placeholderId)
                if (block) {
                  editor.replaceBlocks([block], [{ type: 'paragraph', content: failureMessageWithReason(err) }])
                  setTranscribeStatusWithAutoClear(
                    { type: 'error', message: err instanceof Error ? err.message : String(err) },
                    5000
                  )
                }
              } catch {
                setTranscribeStatusWithAutoClear(
                  { type: 'error', message: err instanceof Error ? err.message : String(err) },
                  5000
                )
              }
            } else {
              setTranscribeStatusWithAutoClear(
                { type: 'error', message: err instanceof Error ? err.message : String(err) },
                5000
              )
            }
          })
          .finally(() => {
            setIsTranscribing(false)
          })
      } catch (err) {
        console.error('Recording/transcription failed:', err)
        setIsTranscribing(false)
        setTranscribeStatusWithAutoClear({ type: 'error', message: err instanceof Error ? err.message : String(err) }, 5000)
      }
    } else {
      await startRecording()
    }
  }, [isRecording, stopRecording, startRecording, blobToArrayBuffer, blobToDataUrl, editor, selectedNoteId, setTranscribeStatusWithAutoClear, transcribeAudio])

  const handleSummarize = useCallback(() => {
    if (!editor) return
    setSummaryError(null)
    let markdown = editor.blocksToMarkdownLossy(editor.document)
    // Strip embedded audio/image data URLs so we don't send 80MB+ base64 to the model
    markdown = markdown.replace(/\[\]\(data:audio\/[^)]+\)/g, '[Audio recording]')
    markdown = markdown.replace(/\[\]\(data:image\/[^)]+\)/g, '[Image]')
    markdown = markdown.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '[Image]')
    const hasContent = markdown.trim().length > 0
    if (!hasContent) {
      setSummaryError('No content to summarize. Add some text to your note first.')
      return
    }

    const doSummarize = async () => {
      try {
        const status = await window.api?.checkAiStatus?.()
        if (!status?.ready) {
          setAiDownloadModalContext('summarize')
          setAiDownloadModalOpen(true)
          return
        }

        // Show "Summarizing..." immediately so UI updates before heavy work
        setIsSummarizing(true)

        // Defer heavy work to next tick so the button can paint "Summarizing..." first
        await new Promise((r) => setTimeout(r, 0))

        // Save current note so main process can load from disk if IPC text is missing
        if (selectedNoteId && window.electron?.ipcRenderer?.invoke) {
          const content = JSON.stringify(editor.document)
          await window.electron.ipcRenderer.invoke('notes-save', {
            id: selectedNoteId,
            title,
            content,
            folderId: selectedFolderId
          })
        }

        const summary = await runSummary({
          text: markdown,
          noteId: selectedNoteId ?? undefined,
          folderId: selectedFolderId
        })
        if (summary) {
          const doc = editor.document
          const refBlock = doc[doc.length - 1]
          if (refBlock) {
            const summaryBlocks = editor.tryParseMarkdownToBlocks(summary.trim())
            const blocksToInsert =
              summaryBlocks.length > 0
                ? [{ type: 'heading' as const, content: 'Summary', props: { level: 2 } }, ...summaryBlocks]
                : [
                    { type: 'heading' as const, content: 'Summary', props: { level: 2 } },
                    { type: 'paragraph' as const, content: summary }
                  ]
            editor.insertBlocks(blocksToInsert, refBlock, 'after')
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Summarization failed'
        console.error('Summarization failed:', err)
        setSummaryError(message)
      } finally {
        setIsSummarizing(false)
      }
    }

    doSummarize()
  }, [editor, selectedNoteId, selectedFolderId, title])

  const totalNotes =
    notesData.rootNotes.length + Object.values(notesData.folderNotes).reduce((s, n) => s + n.length, 0)

  const isWinWithOverlay = window.api?.platform === 'win32'

  return (
    <MantineProvider defaultColorScheme="dark">
      <div className="flex flex-col h-screen bg-background text-foreground font-sans">
        {/* Custom title bar for Windows (with titleBarOverlay) */}
        {isWinWithOverlay && (
          <div
            className="h-10 flex-shrink-0 flex items-center pl-4 bg-sidebar rounded-t-2xl overflow-hidden"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <img src={appIcon} alt="" className="h-6 w-6 object-contain bg-transparent" />
          </div>
        )}
        <div className="flex flex-1 min-h-0 bg-sidebar">
        {/* Collapsible Sidebar */}
        <aside
          className={cn(
            'bg-sidebar flex flex-col transition-all duration-200 overflow-hidden',
            sidebarCollapsed ? 'w-12' : 'w-60'
          )}
        >
          <div className="p-3 flex items-center justify-between flex-shrink-0 border-b border-border bg-sidebar">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => createNewNote()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-border/50 hover:bg-border text-foreground text-sm font-medium transition-colors"
                  title="Add note"
                >
                  <FileText className="w-4 h-4 text-muted flex-shrink-0" />
                  <span className="truncate">Add note</span>
                </button>
                <button
                  onClick={() => {
                    setFolderModal('create')
                    setFolderModalName('')
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-border/50 hover:bg-border text-foreground text-sm font-medium transition-colors"
                  title="Add folder"
                >
                  <FolderPlus className="w-4 h-4 text-muted flex-shrink-0" />
                  <span className="truncate">Add folder</span>
                </button>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg hover:bg-border text-muted hover:text-foreground flex-shrink-0"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <ul className="space-y-1 flex-1 overflow-auto p-2">
              {              totalNotes === 0 ? (
                <li className="text-muted text-sm py-4 px-2">No notes yet. Create one!</li>
              ) : (
                <>
                  {notesData.rootNotes.map((note) => (
                    <li key={note.id}>
                      <div
                        className="relative"
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setNoteContextMenu({ id: note.id, x: e.clientX, y: e.clientY })
                        }}
                      >
                        <button
                          onClick={() => openOrSwitchToTab(note.id, undefined, note.title)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg transition-colors',
                            selectedNoteId === note.id && !selectedFolderId
                              ? 'bg-sidebar text-foreground'
                              : 'hover:bg-border/50 text-foreground'
                          )}
                        >
                          <div className="font-medium truncate">{note.title}</div>
                          <div className="text-xs text-muted">{formatDate(note.updatedAt)}</div>
                        </button>
                      </div>
                    </li>
                  ))}
                  {notesData.folders.map((folderName) => {
                    const isExpanded = expandedFolders.has(folderName)
                    const notes = notesData.folderNotes[folderName] ?? []
                    const meta = notesData.folderMetadata?.[folderName] ?? { icon: DEFAULT_FOLDER_ICON, color: '#e8b840' }
                    const iconColor = meta.color || '#e8b840'
                    const iconName = FOLDER_ICON_MAP[meta.icon ?? ''] ? meta.icon : DEFAULT_FOLDER_ICON
                    return (
                      <li key={folderName}>
                        <div
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-border/50 cursor-pointer group"
                          onClick={() => toggleFolder(folderName)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setFolderMenuOpen(folderName)
                            setContextMenuPos({ x: e.clientX, y: e.clientY })
                          }}
                        >
                          <FolderIconDisplay iconName={iconName} color={iconColor} />
                          <span className="flex-1 truncate text-foreground">{folderName}</span>
                        </div>
                        {/* Right-click context menu */}
                        {contextMenuPos && folderMenuOpen === folderName && typeof contextMenuPos.x === 'number' && typeof contextMenuPos.y === 'number' && (
                          <div
                            ref={contextMenuRef}
                            className="fixed z-50 min-w-[200px] py-1.5 rounded-lg shadow-xl border border-border bg-sidebar"
                            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                              onClick={() => {
                                setContextMenuPos(null)
                                setFolderMenuOpen(null)
                                createNewNote(folderName)
                              }}
                            >
                              <FileText className="w-4 h-4 text-muted flex-shrink-0" />
                              Add note
                            </button>
                            <div className="my-1.5 border-t border-border" />
                            <button
                              className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                              onClick={() => {
                                setContextMenuPos(null)
                                setFolderMenuOpen(null)
                                setFolderModal('rename')
                                setFolderModalName(folderName)
                                setFolderModalTarget(folderName)
                              }}
                            >
                              <Pencil className="w-4 h-4 text-muted flex-shrink-0" />
                              Rename...
                            </button>
                            <div className="my-1.5 border-t border-border" />
                            <button
                              className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                              onClick={() => {
                                setContextMenuPos(null)
                                setFolderMenuOpen(null)
                                setFolderIconModal(folderName)
                              }}
                            >
                              <Image className="w-4 h-4 text-muted flex-shrink-0" />
                              Change icon
                            </button>
                            <button
                              className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                              onClick={() => {
                                setContextMenuPos(null)
                                setFolderMenuOpen(null)
                                setFolderColorModal(folderName)
                              }}
                            >
                              <Palette className="w-4 h-4 text-muted flex-shrink-0" />
                              Change icon color
                            </button>
                            <div className="my-1.5 border-t border-border" />
                            <button
                              className="w-full flex items-center gap-3 px-4 py-2 text-left text-accent hover:bg-border transition-colors"
                              onClick={() => {
                                setContextMenuPos(null)
                                setFolderMenuOpen(null)
                                deleteFolder(folderName)
                              }}
                            >
                              <Trash2 className="w-4 h-4 flex-shrink-0" />
                              Delete
                            </button>
                          </div>
                        )}
                        {isExpanded &&
                          notes.map((note) => (
                            <div key={note.id} className="ml-4 mt-0.5">
                              <div
                                className="relative"
                                onContextMenu={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setNoteContextMenu({ id: note.id, folderId: folderName, x: e.clientX, y: e.clientY })
                                }}
                              >
                                <button
                                  onClick={() => openOrSwitchToTab(note.id, folderName, note.title)}
                                  className={cn(
                                    'w-full text-left px-3 py-2 rounded-lg transition-colors',
                                    selectedNoteId === note.id && selectedFolderId === folderName
                                    ? 'bg-sidebar text-foreground'
                                    : 'hover:bg-border/50 text-foreground'
                                  )}
                                >
                                  <div className="font-medium truncate">{note.title}</div>
                                  <div className="text-xs text-muted">{formatDate(note.updatedAt)}</div>
                                </button>
                              </div>
                            </div>
                          ))}
                      </li>
                    )
                  })}
                </>
              )}
            </ul>
          )}

          <div className="flex-shrink-0 p-2 border-t border-border">
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-border/50 text-foreground"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-muted flex-shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </div>
        </aside>

        {/* Note context menu - rendered once at root to avoid positioning issues */}
        {noteContextMenu && typeof noteContextMenu.x === 'number' && typeof noteContextMenu.y === 'number' && (
          <div
            ref={noteContextMenuRef}
            className="fixed z-[9999] min-w-[160px] py-1.5 rounded-lg shadow-xl border border-border bg-sidebar"
            style={{ left: noteContextMenu.x, top: noteContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-2 text-left text-accent hover:bg-border transition-colors"
              onClick={() => {
                setDeleteNoteTarget({ id: noteContextMenu.id, folderId: noteContextMenu.folderId })
                setNoteContextMenu(null)
              }}
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              Delete
            </button>
          </div>
        )}

        {/* Main - note-taking area */}
        <main className="flex-1 flex flex-col min-w-0 p-4">
          <div className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden bg-background border border-border">
          {/* Tab bar */}
          {openTabs.length > 0 && (
            <div className="flex items-center gap-0 bg-sidebar flex-shrink-0 rounded-t-2xl overflow-hidden">
              <div className="flex items-center gap-0.5 px-2 py-1.5 min-w-0 overflow-x-auto flex-1">
                {openTabs.map((tab, index) => (
                  <div
                    key={tabKey(tab)}
                    role="tab"
                    aria-selected={index === activeTabIndex}
                    onClick={() => switchToTab(index)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 border-transparent transition-colors min-w-0 max-w-[180px] cursor-pointer',
                      index === activeTabIndex
                        ? 'bg-background border-border text-primary border-b-background -mb-px'
                        : 'hover:bg-border/50 text-muted hover:text-foreground'
                    )}
                  >
                    <span className="flex-1 min-w-0 truncate text-sm font-medium">
                      {tab.title || 'Untitled Note'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(index)
                      }}
                      className="p-0.5 rounded hover:bg-border/80 text-muted hover:text-foreground flex-shrink-0"
                      title="Close tab"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => createNewNote()}
                className="p-2 rounded hover:bg-border text-muted hover:text-foreground flex-shrink-0"
                title="New note"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
          <header className="p-4 flex items-center gap-4 flex-shrink-0 bg-background rounded-t-2xl overflow-hidden">
            {savedIndicator && (
              <div className="flex items-center gap-1.5 text-primary text-sm font-medium" title="Saved">
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </div>
            )}
            {transcribeStatus && (
              <div
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium max-w-[280px] truncate',
                  transcribeStatus.type === 'transcribing' && 'text-muted',
                  transcribeStatus.type === 'success' && 'text-primary',
                  transcribeStatus.type === 'error' && 'text-red-500'
                )}
                title={transcribeStatus.message}
              >
                {transcribeStatus.type === 'transcribing' && (
                  <>
                    <span className="animate-pulse">Transcribing...</span>
                  </>
                )}
                {transcribeStatus.type === 'success' && (
                  <>
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>Transcribed</span>
                  </>
                )}
                {transcribeStatus.type === 'error' && (
                  <>
                    <X className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{transcribeStatus.message || 'Transcription failed'}</span>
                  </>
                )}
              </div>
            )}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedNoteId) {
                  e.currentTarget.blur()
                  saveCurrentNote()
                }
              }}
              className="flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-zinc-500"
              placeholder="Note title"
            />

            <Menu position="bottom-end" shadow="md" width={180}>
              <Menu.Target>
                <button
                  className="p-2 rounded-lg hover:bg-border text-muted hover:text-foreground transition-colors"
                  title="File options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </Menu.Target>
              <Menu.Dropdown className="bg-sidebar border-border">
                <Menu.Item
                  leftSection={<Save className="w-4 h-4" />}
                  onClick={saveCurrentNote}
                  disabled={isSaving || !selectedNoteId}
                >
                  {isSaving ? 'Saving...' : 'Save file'}
                </Menu.Item>
                <Menu.Item
                  leftSection={<Trash2 className="w-4 h-4" />}
                  onClick={() => selectedNoteId && setDeleteNoteTarget({ id: selectedNoteId, folderId: selectedFolderId })}
                  disabled={!selectedNoteId}
                  color="red"
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <div className="flex items-center gap-1">
              <button
                onClick={handleRecordToggle}
                disabled={isTranscribing}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  isRecording ? 'bg-accent hover:bg-accent/90 text-white' : 'bg-sidebar hover:bg-border text-foreground'
                )}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    Stop ({recordingTime}s)
                  </>
                ) : isTranscribing ? (
                  'Transcribing...'
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Record
                  </>
                )}
              </button>
              {isRecording && (
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium bg-sidebar hover:bg-border text-foreground transition-colors"
                  title={isPaused ? 'Resume' : 'Pause'}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-0" ref={aiModelDropdownRef}>
                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className="flex items-center gap-2 px-4 py-2 rounded-l-lg font-medium bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {isSummarizing ? 'Summarizing...' : 'AI Summarize'}
                </button>
                <Menu position="bottom-end" shadow="md" width={220}>
                  <Menu.Target>
                    <button
                      type="button"
                      className="flex items-center gap-1 px-2 py-2 rounded-r-lg font-medium bg-primary hover:bg-primary/90 text-white transition-colors border-l border-white/20"
                      title="Choose AI model"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </Menu.Target>
                  <Menu.Dropdown className="bg-sidebar border border-border">
                    {aiModelsList?.models.map((m) => {
                      const downloaded = aiModelsList.downloaded.includes(m.filename)
                      const isSelected = selectedAiModel?.id === m.id
                      return (
                        <Menu.Item
                          key={m.id}
                          leftSection={isSelected ? <Check className="w-4 h-4 text-primary" /> : <span className="w-4" />}
                          rightSection={
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-muted">{m.sizeGb} GB</span>
                              {downloaded ? (
                                <span className="text-xs text-muted">✓</span>
                              ) : (
                                <Download className="w-3.5 h-3.5 text-muted" />
                              )}
                            </span>
                          }
                          className={cn(!downloaded && 'text-muted')}
                          onClick={async () => {
                            if (downloaded) {
                              await window.api?.setSelectedAiModel?.(m.id)
                              setSelectedAiModel({ id: m.id, name: m.name, filename: m.filename, sizeGb: m.sizeGb })
                            } else {
                              setAiDownloadModalContext({ modelId: m.id, modelName: m.name })
                              setAiDownloadModalOpen(true)
                            }
                          }}
                        >
                          {m.name}
                        </Menu.Item>
                      )
                    })}
                  </Menu.Dropdown>
                </Menu>
              </div>
              {summaryError && (
                <p className="text-sm text-red-500/90 max-w-md text-right" role="alert">
                  {summaryError}
                </p>
              )}
            </div>
          </header>

          <div
            ref={editorContainerRef}
            className="flex-1 overflow-auto p-6 relative rounded-b-2xl"
          >
            {(isTranscribing || transcribeStatus?.type === 'transcribing') && (
              <div
                className="sticky top-0 z-10 flex items-center gap-2 py-2 px-4 mb-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-sm font-medium"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" aria-hidden />
                <span>Transcribing recording…</span>
              </div>
            )}
            <div
              className="min-h-full"
              onContextMenu={(e) => {
              e.preventDefault()
              let audioUrl: string | undefined
              let audioBlockId: string | undefined
              if (editor && editorContainerRef.current && editorContainerRef.current.contains(e.target as Node)) {
                const elements = document.elementsFromPoint(e.clientX, e.clientY)
                for (const el of elements) {
                  if (!editorContainerRef.current.contains(el)) continue
                  const withId = el.closest?.('[data-id]') ?? el
                  const id = withId.getAttribute?.('data-id') ?? el.getAttribute?.('data-id')
                  if (!id) continue
                  const block = editor.getBlock(id)
                  if (block?.type === 'audio') {
                    const url = (block as { props?: { url?: string } }).props?.url
                    if (url) {
                      audioUrl = url
                      audioBlockId = id
                    }
                    break
                  }
                }
              }
              setEditorContextMenu({ x: e.clientX, y: e.clientY, audioUrl, audioBlockId })
            }}
          >
            <BlockNoteView
              key={themeId}
              editor={editor}
              theme={blockNoteTheme}
              className="min-h-full"
              onChange={handleEditorChange}
            />
            {editorContextMenu && typeof editorContextMenu.x === 'number' && typeof editorContextMenu.y === 'number' && (
              <div
                ref={editorContextMenuRef}
                className="fixed z-50 min-w-[200px] py-1.5 rounded-lg shadow-xl border border-border bg-sidebar"
                style={{ left: editorContextMenu.x, top: editorContextMenu.y }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.preventDefault()}
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const view = editor.prosemirrorView
                    if (!view) return
                    view.dom.focus()
                    if (!view.state.selection.empty) {
                      const { from, to } = view.state.selection
                      const { externalHTML, markdown } = selectedFragmentToHTML(view, editor)
                      navigator.clipboard
                        .write([
                          new ClipboardItem({
                            'text/html': new Blob([externalHTML], { type: 'text/html' }),
                            'text/plain': new Blob([markdown], { type: 'text/plain' })
                          })
                        ])
                        .then(() => {
                          const tr = view.state.tr.delete(from, to)
                          view.dispatch(tr)
                        })
                        .catch(console.error)
                    }
                    setEditorContextMenu(null)
                  }}
                >
                  <Scissors className="w-4 h-4 text-muted flex-shrink-0" />
                  Cut
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const view = editor.prosemirrorView
                    if (!view) return
                    view.dom.focus()
                    if (!view.state.selection.empty) {
                      const { externalHTML, markdown } = selectedFragmentToHTML(view, editor)
                      navigator.clipboard
                        .write([
                          new ClipboardItem({
                            'text/html': new Blob([externalHTML], { type: 'text/html' }),
                            'text/plain': new Blob([markdown], { type: 'text/plain' })
                          })
                        ])
                        .catch(console.error)
                    }
                    setEditorContextMenu(null)
                  }}
                >
                  <Copy className="w-4 h-4 text-muted flex-shrink-0" />
                  Copy
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                  onMouseDown={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const view = editor.prosemirrorView
                    if (!view) return
                    view.dom.focus()
                    let pasted = false
                    try {
                      const items = await navigator.clipboard.read()
                      for (const item of items) {
                        const types = item.types
                        if (types.includes('blocknote/html')) {
                          const blob = await item.getType('blocknote/html')
                          const html = await blob.text()
                          editor.pasteHTML(html, true)
                          pasted = true
                          break
                        }
                        if (types.includes('text/html')) {
                          const blob = await item.getType('text/html')
                          const html = await blob.text()
                          editor.pasteHTML(html)
                          pasted = true
                          break
                        }
                        if (types.includes('text/plain')) {
                          const blob = await item.getType('text/plain')
                          const text = await blob.text()
                          editor.pasteText(text)
                          pasted = true
                          break
                        }
                      }
                      if (!pasted) {
                        const text = await navigator.clipboard.readText()
                        if (text) {
                          editor.pasteText(text)
                        }
                      }
                    } catch {
                      try {
                        const text = await navigator.clipboard.readText()
                        if (text) editor.pasteText(text)
                      } catch {
                        /* clipboard read may fail without permission */
                      }
                    }
                    setEditorContextMenu(null)
                  }}
                >
                  <ClipboardPaste className="w-4 h-4 text-muted flex-shrink-0" />
                  Paste
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                  onMouseDown={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const view = editor.prosemirrorView
                    if (!view) return
                    view.dom.focus()
                    try {
                      const text = await navigator.clipboard.readText()
                      if (text) editor.pasteText(text)
                    } catch {
                      /* clipboard read may fail without permission */
                    }
                    setEditorContextMenu(null)
                  }}
                >
                  <ClipboardType className="w-4 h-4 text-muted flex-shrink-0" />
                  Paste as plain text
                </button>
                <div className="my-1.5 border-t border-border" />
                {editorContextMenu.audioUrl && (
                  <>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={transcribeStatus?.type === 'transcribing'}
                      onMouseDown={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const url = editorContextMenu.audioUrl
                        const blockId = editorContextMenu.audioBlockId
                        setEditorContextMenu(null)
                        if (!url || !blockId || !editor) return
                        setTranscribeStatusWithAutoClear({ type: 'transcribing' })
                        try {
                          const buffer = dataUrlToArrayBuffer(url)
                          const text = await transcribeAudio(buffer)
                          if (text && text.trim()) {
                            const audioBlock = editor.getBlock(blockId)
                            if (audioBlock) editor.insertBlocks([{ type: 'paragraph', content: text.trim() }], audioBlock, 'after')
                            setTranscribeStatusWithAutoClear({ type: 'success' }, 3000)
                          } else {
                            setTranscribeStatusWithAutoClear({ type: 'error', message: 'No text returned' }, 5000)
                          }
                        } catch (err) {
                          const message = err instanceof Error ? err.message : String(err)
                          console.error('Transcribe failed:', err)
                          setTranscribeStatusWithAutoClear({ type: 'error', message }, 5000)
                        }
                      }}
                    >
                      <FileText className="w-4 h-4 text-muted flex-shrink-0" />
                      {transcribeStatus?.type === 'transcribing' ? 'Transcribing...' : 'Transcribe'}
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                      onMouseDown={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const url = editorContextMenu.audioUrl
                        setEditorContextMenu(null)
                        if (!url || !window.api?.exportAudioAsWav) return
                        try {
                          const result = await window.api.exportAudioAsWav(url)
                          if (!result.success && result.error && !result.canceled) {
                            console.error('Export audio as WAV failed:', result.error)
                          }
                        } catch (err) {
                          console.error('Export audio as WAV failed:', err)
                        }
                      }}
                    >
                      <Download className="w-4 h-4 text-muted flex-shrink-0" />
                      Download as WAV
                    </button>
                  </>
                )}
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-foreground hover:bg-border transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const view = editor.prosemirrorView
                    if (!view) return
                    view.dom.focus()
                    const { doc } = view.state
                    view.dispatch(view.state.tr.setSelection(new AllSelection(doc)))
                    setEditorContextMenu(null)
                  }}
                >
                  <SquareDashed className="w-4 h-4 text-muted flex-shrink-0" />
                  Select all
                </button>
              </div>
            )}
          </div>
          </div>
          </div>
        </main>

        <SettingsModal opened={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
        </div>
      </div>

      {/* Folder Create/Rename Modal */}
      <Modal
        opened={folderModal !== null}
        onClose={() => {
          setFolderModal(null)
          setFolderModalName('')
          setFolderModalTarget(null)
        }}
        title={folderModal === 'create' ? 'New Folder' : 'Rename Folder'}
        centered
        withCloseButton={false}
        zIndex={10000}
        radius={20}
        overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
        classNames={{
          inner: '!bg-sidebar',
          content: '!bg-sidebar border border-border rounded-[20px] overflow-hidden',
          header: '!bg-sidebar border-b border-border',
          title: 'text-foreground',
          body: '!bg-sidebar'
        }}
      >
        <TextInput
          label="Folder name"
          value={folderModalName}
          onChange={(e) => setFolderModalName(e.target.value)}
          placeholder="Enter folder name"
          styles={{
            input: { backgroundColor: '#27241f', color: '#d7c097', borderColor: '#423d33' }
          }}
          classNames={{
            root: 'mb-4',
            label: 'text-foreground mb-1.5',
            input: '!bg-background !border-border !text-foreground placeholder:!text-muted'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (folderModal === 'create') createFolder()
              else renameFolder()
            }
          }}
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => (folderModal === 'create' ? createFolder() : renameFolder())}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {folderModal === 'create' ? 'Create' : 'Rename'}
          </button>
          <button
            onClick={() => {
              setFolderModal(null)
              setFolderModalName('')
              setFolderModalTarget(null)
            }}
            className="px-4 py-2 rounded-lg bg-border hover:bg-border/80 text-foreground"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Delete Note Confirmation Modal */}
      <Modal
        opened={deleteNoteTarget !== null}
        onClose={() => setDeleteNoteTarget(null)}
        title="Delete note"
        centered
        withCloseButton={false}
        zIndex={10000}
        radius={20}
        overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
        classNames={{
          inner: '!bg-zinc-900',
          content: '!bg-zinc-900 border border-zinc-800 rounded-[20px] overflow-hidden',
          header: '!bg-zinc-900 border-b border-zinc-800',
          title: 'text-zinc-100',
          body: '!bg-zinc-900'
        }}
      >
        <p className="text-zinc-300 mb-6">Are you sure you want to delete this note? This action cannot be undone.</p>
        <div className="flex gap-2">
          <button
            onClick={() => deleteNoteTarget && deleteNote(deleteNoteTarget.id, deleteNoteTarget.folderId)}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white"
          >
            Delete
          </button>
          <button
            onClick={() => setDeleteNoteTarget(null)}
            className="px-4 py-2 rounded-lg bg-border hover:bg-border/80 text-foreground"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Change Folder Icon Modal */}
      <Modal
        opened={folderIconModal !== null}
        onClose={() => setFolderIconModal(null)}
        title="Change folder icon"
        centered
        withCloseButton={false}
        zIndex={10000}
        radius={20}
        overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
        classNames={{
          inner: '!bg-sidebar',
          content: '!bg-sidebar border border-border rounded-[20px] overflow-hidden',
          header: '!bg-sidebar border-b border-border',
          title: 'text-foreground',
          body: '!bg-sidebar'
        }}
      >
        {folderIconModal && (() => {
          const meta = notesData.folderMetadata?.[folderIconModal] ?? { icon: DEFAULT_FOLDER_ICON, color: '#e8b840' }
          const iconColor = meta.color || '#e8b840'
          const currentIcon = FOLDER_ICON_MAP[meta.icon ?? ''] ? meta.icon : DEFAULT_FOLDER_ICON
          return (
            <div className="grid grid-cols-8 gap-2 max-h-[320px] overflow-auto py-2">
              {FOLDER_ICON_NAMES.map((name) => {
                const IconComponent = FOLDER_ICON_MAP[name]
                const isSelected = currentIcon === name
                return IconComponent ? (
                  <button
                    key={name}
                    onClick={() => {
                      setFolderMetadata(folderIconModal, { icon: name })
                      setFolderIconModal(null)
                    }}
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center transition-colors border-2 border-transparent',
                      isSelected ? 'bg-primary/20' : 'hover:bg-border'
                    )}
                    style={isSelected ? { borderColor: iconColor } : {}}
                    title={name}
                  >
                    <IconComponent className="w-5 h-5" style={{ color: iconColor }} />
                  </button>
                ) : null
              })}
            </div>
          )
        })()}
      </Modal>

      {/* AI Download Modal */}
      <AiDownloadModal
        opened={aiDownloadModalOpen}
        onClose={() => {
          setAiDownloadModalOpen(false)
          setAiDownloadModalContext(null)
        }}
        onDownloadComplete={() => {
          setAiDownloadModalOpen(false)
          const ctx = aiDownloadModalContext
          setAiDownloadModalContext(null)
          loadAiModelsAndSelected()
          if (ctx === 'summarize') handleSummarize()
        }}
        modelId={aiDownloadModalContext && typeof aiDownloadModalContext === 'object' ? aiDownloadModalContext.modelId : undefined}
        modelName={aiDownloadModalContext && typeof aiDownloadModalContext === 'object' ? aiDownloadModalContext.modelName : selectedAiModel?.name}
      />

      {/* Change Folder Icon Color Modal */}
      <Modal
        opened={folderColorModal !== null}
        onClose={() => setFolderColorModal(null)}
        title="Change icon color"
        centered
        withCloseButton={false}
        zIndex={10000}
        radius={20}
        overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
        classNames={{
          inner: '!bg-sidebar',
          content: '!bg-sidebar border border-border rounded-[20px] overflow-hidden',
          header: '!bg-sidebar border-b border-border',
          title: 'text-foreground',
          body: '!bg-sidebar'
        }}
      >
        {folderColorModal && (
          <FolderColorPicker
            key={folderColorModal}
            color={notesData.folderMetadata?.[folderColorModal]?.color ?? DEFAULT_ICON_COLOR}
            defaultColor={DEFAULT_ICON_COLOR}
            onChange={(hex) => setFolderMetadata(folderColorModal, { color: hex })}
            onSave={() => setFolderColorModal(null)}
            onReset={() => setFolderMetadata(folderColorModal, { color: DEFAULT_ICON_COLOR })}
          />
        )}
      </Modal>
      {/* App Update Modal */}
      <Modal
        opened={updateModalOpen}
        onClose={() => {
          if (updateStatus === 'downloading') return
          setUpdateModalOpen(false)
          setUpdateError(null)
        }}
        title="Update available"
        centered
        withCloseButton={updateStatus !== 'downloading'}
        closeOnClickOutside={updateStatus !== 'downloading'}
        closeOnEscape={updateStatus !== 'downloading'}
        zIndex={10000}
        radius={20}
        overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
        classNames={{
          inner: '!bg-sidebar',
          content: '!bg-sidebar border border-border rounded-[20px] overflow-hidden',
          header: '!bg-sidebar border-b border-border',
          title: 'text-foreground',
          body: '!bg-sidebar'
        }}
      >
        <div className="space-y-3">
          {updateStatus === 'available' && (
            <>
              <p className="text-foreground text-sm">
                {updateVersion
                  ? `A new version of Locus (${updateVersion}) is available.`
                  : 'A new version of Locus is available.'}
              </p>
              {updateReleaseNotes != null && formatReleaseNotes(updateReleaseNotes) && (
                <div className="max-h-40 overflow-auto rounded-lg bg-[#27241f] border border-border p-2 text-xs text-muted whitespace-pre-wrap">
                  {formatReleaseNotes(updateReleaseNotes)}
                </div>
              )}
            </>
          )}
          {updateStatus === 'downloading' && (
            <p className="text-foreground text-sm">
              Downloading update… {updateProgress}% (you can keep using the app).
            </p>
          )}
          {updateStatus === 'downloaded' && (
            <p className="text-foreground text-sm">
              The update has been downloaded. Restart now to finish installing.
            </p>
          )}
          {updateStatus === 'error' && updateError && (
            <p className="text-red-500 text-sm">
              Update error: {updateError}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            {updateStatus === 'available' && (
              <button
                onClick={async () => {
                  if (!window.api?.downloadUpdate) return
                  setUpdateStatus('downloading')
                  setUpdateProgress(0)
                  setUpdateError(null)
                  const result = await window.api.downloadUpdate()
                  if (!result.success && result.error) {
                    setUpdateError(result.error)
                    setUpdateStatus('error')
                  }
                }}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white"
              >
                Download and Install
              </button>
            )}
            {updateStatus === 'downloaded' && (
              <button
                onClick={() => {
                  window.api?.quitAndInstall?.()
                }}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white"
              >
                Restart Now
              </button>
            )}
            {updateStatus !== 'downloading' && (
              <button
                onClick={() => setUpdateModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-border hover:bg-border/80 text-foreground"
              >
                Later
              </button>
            )}
          </div>
        </div>
      </Modal>
    </MantineProvider>
  )
}
