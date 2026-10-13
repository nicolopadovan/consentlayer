'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type {
  Analytics,
  ConsentApi,
  ConsentState,
  LazyBootConfig,
  PageViewPayload,
} from '../core/types'
import { ConsentControllerProvider } from './consent-controller'

type AnalyticsContextValue = {
  analytics: Analytics
  consent: ConsentState | null
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined)

export type AnalyticsProviderProps = {
  analytics: Analytics
  children: ReactNode
  /** Changes on every navigation; a page view is sent once per key. */
  routeKey?: string
  page?: PageViewPayload
  /** When providers load. Defaults to `{ mode: 'immediate' }`. */
  boot?: LazyBootConfig
  autoShowBanner?: boolean
  /** Defaults to the configured name (plus the legacy `ACM_openConsent`). */
  openConsentGlobalKey?: string
}

function scheduleBoot(
  analytics: Analytics,
  boot: LazyBootConfig | undefined,
): () => void {
  const mode = boot?.mode ?? 'immediate'
  if (mode === 'manual') return () => undefined
  if (mode === 'immediate' || typeof window === 'undefined') {
    void analytics.boot()
    return () => undefined
  }
  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(
      () => void analytics.boot(),
      { timeout: boot?.timeoutMs ?? 3000 },
    )
    return () => window.cancelIdleCallback?.(handle)
  }
  const timeout = globalThis.setTimeout(
    () => void analytics.boot(),
    boot?.timeoutMs ?? 1500,
  )
  return () => globalThis.clearTimeout(timeout)
}

export function AnalyticsProvider({
  analytics,
  children,
  routeKey = 'default',
  page,
  boot,
  autoShowBanner,
  openConsentGlobalKey,
}: AnalyticsProviderProps) {
  const consent = useSyncExternalStore(
    (listener) => analytics.consent.subscribe(listener),
    () => analytics.consent.getConsent(),
    () => analytics.consent.getConsent(),
  )
  const snapshot = useSyncExternalStore(
    (listener) => analytics.subscribe(listener),
    () => analytics.getSnapshot(),
    () => analytics.getSnapshot(),
  )
  const bootRef = useRef(boot)
  const trackedRouteKey = useRef<string | null>(null)
  const sessionRouteKey = useRef(routeKey)

  useEffect(() => {
    void analytics.consent.bootstrap()
  }, [analytics])

  useEffect(() => scheduleBoot(analytics, bootRef.current), [analytics])

  useEffect(() => {
    if (!snapshot.booted || snapshot.activeProviders.length === 0) return
    if (trackedRouteKey.current === routeKey) return
    trackedRouteKey.current = routeKey
    void analytics.page(page)
  }, [analytics, page, routeKey, snapshot])

  useEffect(() => {
    if (sessionRouteKey.current === routeKey) return
    sessionRouteKey.current = routeKey
    analytics.newPageSession()
  }, [analytics, routeKey])

  const value = useMemo(() => ({ analytics, consent }), [analytics, consent])

  return (
    <AnalyticsContext.Provider value={value}>
      <ConsentControllerProvider
        autoShowBanner={autoShowBanner}
        openConsentGlobalKey={openConsentGlobalKey}
      >
        {children}
      </ConsentControllerProvider>
    </AnalyticsContext.Provider>
  )
}

function useAnalyticsContext(hook: string): AnalyticsContextValue {
  const value = useContext(AnalyticsContext)
  if (!value) throw new Error(`${hook} must be used within AnalyticsProvider`)
  return value
}

export function useAnalytics(): Analytics {
  return useAnalyticsContext('useAnalytics').analytics
}

export function useConsent(): {
  consent: ConsentState | null
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
} {
  const { analytics, consent } = useAnalyticsContext('useConsent')
  return {
    consent,
    engine: analytics.consent,
    setConsent: (next) => analytics.consent.setConsent(next),
    update: (partial) => analytics.consent.update(partial),
  }
}
