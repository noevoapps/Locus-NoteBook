import { useState, useEffect } from 'react'
import { Modal, Progress } from '@mantine/core'
import { Sparkles } from 'lucide-react'

type AiDownloadModalProps = {
  opened: boolean
  onClose: () => void
  onDownloadComplete: () => void
}

export function AiDownloadModal({ opened, onClose, onDownloadComplete }: AiDownloadModalProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!opened || !window.api?.onDownloadProgress) return
    const unsubscribe = window.api.onDownloadProgress((percent) => {
      setProgress(percent)
    })
    return unsubscribe
  }, [opened])

  const handleDownload = async () => {
    if (!window.api?.downloadAiModel) return
    setError(null)
    setIsDownloading(true)
    setProgress(0)
    try {
      await window.api.downloadAiModel()
      onDownloadComplete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span>Smart Summaries</span>
        </div>
      }
      centered
      withCloseButton={!isDownloading}
      closeOnClickOutside={!isDownloading}
      closeOnEscape={!isDownloading}
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
      <div className="space-y-4">
        <p className="text-foreground text-sm">
          To use Smart Summaries, we need to download the AI Brain (~4GB). This only happens once.
        </p>

        {isDownloading && (
          <div className="space-y-2">
            <Progress value={progress} size="lg" radius="xl" color="primary" />
            <p className="text-muted text-sm text-center">{progress}%</p>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? 'Downloading...' : 'Download Now'}
          </button>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="px-4 py-2 rounded-lg bg-border hover:bg-border/80 text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
