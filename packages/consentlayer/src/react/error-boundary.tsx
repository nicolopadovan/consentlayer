'use client'

import { Component, useEffect, type ContextType, type ReactNode } from 'react'
import type { Analytics, ErrorContext } from '../core/types'
import { AnalyticsContext } from './analytics-provider'

type FallbackProps = { error: unknown; reset: () => void }

export type ErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode | ((props: FallbackProps) => ReactNode)
  /** Defaults to the instance from `<AnalyticsProvider>`. */
  analytics?: Analytics
  tags?: ErrorContext['tags']
}

/** Renders `fallback` when a child throws, and sends the error through `captureError`. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: unknown; failed: boolean }> {
  static contextType = AnalyticsContext
  declare context: ContextType<typeof AnalyticsContext>
  state = { error: undefined as unknown, failed: false }

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true }
  }

  componentDidCatch(error: unknown) {
    const analytics = this.props.analytics ?? this.context?.analytics
    void analytics?.captureError(error, { source: 'boundary', tags: this.props.tags })
  }

  reset = () => this.setState({ error: undefined, failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    const { fallback } = this.props
    return typeof fallback === 'function' ? fallback({ error: this.state.error, reset: this.reset }) : fallback
  }
}

/**
 * The component for Next.js `app/global-error.tsx`, which replaces the root
 * layout, so `<AnalyticsProvider>` isn't there: pass the instance.
 *
 * ```tsx
 * 'use client'
 * export default createGlobalError(analytics)
 * ```
 */
export function createGlobalError(
  analytics: Analytics,
  render: (props: FallbackProps) => ReactNode = ({ reset }) => (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Something went wrong.</h1>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  ),
) {
  return function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
      void (async () => {
        await analytics.consent.bootstrap()
        await analytics.boot()
        await analytics.captureError(error, {
          source: 'boundary',
          level: 'fatal',
          tags: error.digest ? { digest: error.digest } : undefined,
        })
      })()
    }, [error])
    return (
      <html lang="en">
        <body>{render({ error, reset })}</body>
      </html>
    )
  }
}
