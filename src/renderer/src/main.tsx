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
