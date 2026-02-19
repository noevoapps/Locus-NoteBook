import * as Sentry from '@sentry/electron/renderer'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App error:', error, errorInfo)
    Sentry.captureException(error, {
      level: 'error',
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      },
      extra: {
        componentStack: errorInfo.componentStack
      }
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#1a1a1a',
            color: '#e0e0e0',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          <h1 style={{ color: '#e07c5e', margin: 0 }}>Something went wrong</h1>
          <pre
            style={{
              background: '#2a2a2a',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 14
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: '#4d9cbc',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
