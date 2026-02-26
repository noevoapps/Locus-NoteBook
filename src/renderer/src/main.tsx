import '@fontsource/karla'
import '@fontsource/karla/700.css'
import '@mantine/core/styles.css'
import './assets/main.css'

import * as Sentry from '@sentry/electron/renderer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'

const SENTRY_DSN =
  'https://95be6fe73d23d7158ed1ad18a8ab679a@o4510869943681024.ingest.us.sentry.io/4510869956657152'

// Single source of truth for Sentry (updated on load and when user toggles in Settings)
declare global {
  interface Window {
    __shareAnalytics?: boolean
  }
}
window.__shareAnalytics = true
window.api?.getPrivacySettings?.().then((s) => {
  if (s && typeof s.shareAnalytics === 'boolean') window.__shareAnalytics = s.shareAnalytics
})

const isDev = typeof import.meta.env !== 'undefined' && import.meta.env.DEV

Sentry.init({
  dsn: SENTRY_DSN,
  environment: isDev ? 'development' : 'production',
  attachStacktrace: true,
  maxBreadcrumbs: 100,
  beforeSend(event, hint) {
    if (window.__shareAnalytics === false) return null
    const error = hint?.originalException
    if (event.message && error instanceof Error && !event.exception?.values?.length) {
      event.message = `${error.name}: ${error.message}`
    }
    return event
  }
})

Sentry.setTag('process', 'renderer')
// Release is set in the main process Sentry.init(); renderer does not expose setRelease.

// Log all renderer errors to main process so they appear in userData/logs/locus.log (visible after crash).
function logToFile(level: string, message: string, detail?: unknown) {
  try {
    window.api?.logToMain?.(level, message, detail)
  } catch {
    /* ignore if IPC not ready */
  }
}

window.addEventListener('error', (event) => {
  const msg = event.message || String(event.error)
  const err = event.error instanceof Error ? event.error : new Error(msg)
  logToFile('error', `window.error: ${msg}`, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: err.stack
  })
  if (window.__shareAnalytics !== false) {
    Sentry.captureException(err, {
      extra: { filename: event.filename, lineno: event.lineno, colno: event.colno }
    })
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const err = reason instanceof Error ? reason : new Error(String(reason))
  logToFile('error', `unhandledrejection: ${err.message}`, { stack: err instanceof Error ? err.stack : undefined })
  if (window.__shareAnalytics !== false) {
    Sentry.captureException(err, { extra: { type: 'unhandledrejection' } })
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
