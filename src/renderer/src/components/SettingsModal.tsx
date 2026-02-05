import { useState, useEffect } from 'react'
import { Modal, Switch, Button } from '@mantine/core'
import { Settings, Bug } from 'lucide-react'
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
  const { themeId, setTheme, themeIds } = useTheme()

  useEffect(() => {
    if (!opened) return
    window.api?.getPrivacySettings?.().then((s) => {
      if (s && typeof s.shareAnalytics === 'boolean') setShareAnalytics(s.shareAnalytics)
    })
  }, [opened])
  useEffect(() => {
    if (!opened) setTestEventSent(false)
  }, [opened])

  const handleToggleAnalytics = async () => {
    const result = await window.api?.toggleAnalytics?.()
    if (result && typeof result.shareAnalytics === 'boolean') setShareAnalytics(result.shareAnalytics)
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
        header: '!bg-sidebar border-b border-border',
        title: 'text-foreground',
        body: '!bg-sidebar'
      }}
    >
      <div className="space-y-6">
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
            <Button
              variant="light"
              size="xs"
              leftSection={<Bug className="w-3.5 h-3.5" />}
              loading={testEventSending}
              onClick={handleSendTestEvent}
              classNames={{ root: 'mt-2' }}
            >
              {testEventSent ? 'Test events sent' : 'Send test event to Sentry'}
            </Button>
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
                  onClick={() => setTheme(id as ThemeId)}
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
      </div>
    </Modal>
  )
}
