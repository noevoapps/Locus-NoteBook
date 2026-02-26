import { useState, useEffect } from 'react'
import { Modal, Switch, Button } from '@mantine/core'
import { Settings, Bug, BarChart3, RefreshCw, FileText } from 'lucide-react'
import * as Sentry from '@sentry/electron/renderer'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { THEMES, type ThemeId } from '../themes'
import { useTheme } from '../hooks/useTheme'

function cn(...inputs: (string | undefined)[]) {
  return twMerge(clsx(inputs))
}

type SettingsModalProps = {
  opened: boolean
  onClose: () => void
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const [shareAnalytics, setShareAnalytics] = useState(true)
  const [logPath, setLogPath] = useState<string | null>(null)
  const { themeId, setTheme, themeIds } = useTheme()

  useEffect(() => {
    if (!opened) return
    window.api?.getLogPath?.().then((p) => setLogPath(p ?? null))
  }, [opened])

  useEffect(() => {
    if (!opened) return
    window.api?.getPrivacySettings?.().then((s) => {
      if (s && typeof s.shareAnalytics === 'boolean') {
        setShareAnalytics(s.shareAnalytics)
        window.__shareAnalytics = s.shareAnalytics
      }
    })
  }, [opened])
  useEffect(() => {
    if (!opened) {
      setTestEventSent(false)
      setAptabaseTestResult(null)
      setShowRestartForThemeModal(false)
    }
  }, [opened])

  const handleToggleAnalytics = async () => {
    const result = await window.api?.toggleAnalytics?.()
    if (result && typeof result.shareAnalytics === 'boolean') {
      setShareAnalytics(result.shareAnalytics)
      window.__shareAnalytics = result.shareAnalytics
    }
  }

  const [testEventSending, setTestEventSending] = useState(false)
  const [testEventSent, setTestEventSent] = useState(false)
  const handleSendTestEvent = async () => {
    if (!shareAnalytics) return
    setTestEventSending(true)
    setTestEventSent(false)
    try {
      const mainResult = await window.api?.sendSentryTestEvent?.()
      if (mainResult?.sent) {
        Sentry.captureException(new Error('Locus test event (renderer process)'))
      }
      setTestEventSent(true)
    } finally {
      setTestEventSending(false)
    }
  }

  const [aptabaseTestSending, setAptabaseTestSending] = useState(false)
  const [aptabaseTestResult, setAptabaseTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [showRestartForThemeModal, setShowRestartForThemeModal] = useState(false)
  const handleThemeChange = (id: ThemeId) => {
    if (id === themeId) return
    setTheme(id)
    setShowRestartForThemeModal(true)
  }
  const handleAptabaseTestEvent = async () => {
    setAptabaseTestResult(null)
    setAptabaseTestSending(true)
    try {
      const result = await window.api?.sendAptabaseTestEvent?.()
      setAptabaseTestResult(result ?? { success: false, error: 'Not available' })
    } finally {
      setAptabaseTestSending(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <span>Settings</span>
        </div>
      }
      centered
      zIndex={10000}
      radius={20}
      overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
      classNames={{
        inner: '!bg-sidebar',
        content: '!bg-sidebar border border-border rounded-[20px] overflow-hidden',
        header: '!bg-sidebar border-b border-border !pb-3',
        title: 'text-foreground',
        body: '!bg-sidebar !pt-3'
      }}
    >
      <div className="space-y-4">
        <section>
          <Switch
            label="Share anonymous crash reports & usage data"
            description="Helps us fix bugs. No audio or personal notes are ever sent."
            checked={shareAnalytics}
            onChange={handleToggleAnalytics}
            size="md"
            classNames={{
              root: 'flex flex-col gap-1',
              label: 'text-foreground font-medium',
              description: 'text-muted text-sm'
            }}
          />
          {shareAnalytics && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<Bug className="w-3.5 h-3.5" />}
                  loading={testEventSending}
                  onClick={handleSendTestEvent}
                >
                  {testEventSent ? 'Sentry test sent' : 'Send test event to Sentry'}
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<BarChart3 className="w-3.5 h-3.5" />}
                  loading={aptabaseTestSending}
                  onClick={handleAptabaseTestEvent}
                >
                  Send test event to Aptabase
                </Button>
              </div>
              {aptabaseTestResult && (
                <p
                  className={cn(
                    'text-xs',
                    aptabaseTestResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                  )}
                >
                  {aptabaseTestResult.success
                    ? 'Aptabase test event sent. It may take a few minutes to appear in your dashboard.'
                    : `Aptabase: ${aptabaseTestResult.error}`}
                </p>
              )}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-medium text-foreground mb-3">Theme</h3>
          <div className="flex flex-wrap gap-2">
            {themeIds.map((id) => {
              const t = THEMES[id]
              if (!t) return null
              return (
                <button
                  key={id}
                  onClick={() => handleThemeChange(id as ThemeId)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors',
                    themeId === id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-border/50 text-foreground'
                  )}
                >
                  <div
                    className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                    style={{ backgroundColor: t.colors.primary }}
                  />
                  <span>{t.name}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-foreground mb-3">Debug logging</h3>
          <p className="text-muted text-sm mb-2">
            Errors and main-process logs are written to a file. If the app crashes (e.g. when switching tabs), open this
            file to see what went wrong.
          </p>
          {logPath && (
            <p className="text-muted text-xs font-mono truncate mb-2" title={logPath}>
              {logPath}
            </p>
          )}
          <Button
            variant="light"
            size="xs"
            leftSection={<FileText className="w-3.5 h-3.5" />}
            onClick={async () => {
              const result = await window.api?.openLogFile?.()
              if (result && !result.opened && result.error) {
                console.error('Open log file:', result.error)
              }
            }}
          >
            Open log file
          </Button>
        </section>
      </div>

      <Modal
        opened={showRestartForThemeModal}
        onClose={() => setShowRestartForThemeModal(false)}
        title="Restart required"
        centered
        zIndex={10001}
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
        <p className="text-foreground text-sm mb-4">
          Theme updated. Please restart the app for the new theme to apply to the note editor.
        </p>
        <div className="flex gap-2">
          <Button
            variant="filled"
            leftSection={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              window.api?.relaunchApp?.()
            }}
            classNames={{ root: 'bg-primary hover:bg-primary/90' }}
          >
            Restart now
          </Button>
          <Button variant="default" onClick={() => setShowRestartForThemeModal(false)}>
            Later
          </Button>
        </div>
      </Modal>
    </Modal>
  )
}
