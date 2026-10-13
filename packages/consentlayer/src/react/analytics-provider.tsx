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
import type { ConsentMessageOverrides } from '../ui/messages'
import { ConsentControllerProvider } from './consent-controller'

type AnalyticsContextValue = {
  analytics: Analytics
  consent: ConsentState | null
}

export const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined)

/** Props for `<AnalyticsProvider>`. */
export type AnalyticsProviderProps = {
  analytics: Analytics
  children: ReactNode
  /** Changes on every navigation; a page view is sent once per key. */
  routeKey?: string
  page?: PageViewPayload
  /** When providers load. Defaults to `{ mode: 'immediate' }`. */
  boot?: LazyBootConfig
  autoShowBanner?: boolean
  /** Defaults to the configured name (plus `ACM_openConsent` with `names.legacy`). */
  openConsentGlobalKey?: string
  /** Consent UI language. Falls back to `createAnalytics({ locale })`, then `<html lang>`, then English. */
  locale?: string
  /** Overrides for any consent UI string, keyed by locale. */
  messages?: ConsentMessageOverrides
  /** Adds a privacy policy link to the banner and dialog. */
  privacyPolicyUrl?: string
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

/** Boots analytics, sends page views on navigation and provides the consent UI state. */
export function AnalyticsProvider({
  analytics,
  children,
  routeKey = 'default',
  page,
  boot,
  autoShowBanner,
  openConsentGlobalKey,
  locale,
  messages,
  privacyPolicyUrl,
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
  const paged = useRef<{ routeKey: string | null; providers: Set<string> }>({
    routeKey: null,
    providers: new Set(),
  })
  const sessionRouteKey = useRef(routeKey)

  useEffect(() => {
    void analytics.consent.bootstrap()
  }, [analytics])

  useEffect(() => scheduleBoot(analytics, bootRef.current), [analytics])

  useEffect(() => {
    if (!snapshot.booted) return
    if (paged.current.routeKey !== routeKey) {
      paged.current = { routeKey, providers: new Set() }
    }
    const fresh = snapshot.activeProviders.filter((id) => !paged.current.providers.has(id))
    if (!fresh.length) return
    fresh.forEach((id) => paged.current.providers.add(id))
    void analytics.page(page, { only: fresh })
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
        locale={locale}
        messages={messages}
        privacyPolicyUrl={privacyPolicyUrl}
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

/** The analytics instance from `<AnalyticsProvider>`. */
export function useAnalytics(): Analytics {
  return useAnalyticsContext('useAnalytics').analytics
}

/** Current consent, re-rendering when it changes. */
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
