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
  'https://5fae01abe192da9057d224c5fe7f494d@o4510830153433088.ingest.us.sentry.io/4510830313406464'

let shareAnalytics = true
window.api?.getPrivacySettings?.().then((s) => {
  if (s && typeof s.shareAnalytics === 'boolean') shareAnalytics = s.shareAnalytics
})

Sentry.init({
  dsn: SENTRY_DSN,
  beforeSend(event) {
    if (!shareAnalytics) return null
    return event
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
