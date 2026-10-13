'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
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
import { latestAnalytics } from '../core/create-analytics'
import {
  createConsentController,
  type ConsentControllerActions,
  type ConsentControllerState,
} from '../core/consent-controller'

export const AnalyticsContext = createContext<Analytics | undefined>(undefined)

type ConsentControllerValue = ConsentControllerState & ConsentControllerActions

const ConsentControllerContext = createContext<ConsentControllerValue | undefined>(undefined)

/** Props for `<AnalyticsProvider>`. */
export type AnalyticsProviderProps = {
  analytics: Analytics
  children: ReactNode
  /** Changes on every navigation; a page view is sent once per key. `null` holds page views until the route is known. */
  routeKey?: string | null
  page?: PageViewPayload
  /** When providers load. Defaults to `{ mode: 'immediate' }`. */
  boot?: LazyBootConfig
  autoShowBanner?: boolean
  /** Defaults to the configured name (plus `ACM_openConsent` with `names.legacy`). */
  openConsentGlobalKey?: string
}

/** Boots analytics, sends page views on navigation and provides the state for your consent UI. */
export function AnalyticsProvider({
  analytics,
  children,
  routeKey = 'default',
  page,
  boot,
  autoShowBanner,
  openConsentGlobalKey,
}: AnalyticsProviderProps) {
  const [controller] = useState(() => createConsentController(analytics, { boot, autoShowBanner, openConsentGlobalKey }))
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const value = useMemo<ConsentControllerValue>(() => ({ ...controller.actions, ...state }), [controller, state])

  useEffect(() => controller.start(), [controller])
  useEffect(() => controller.setRoute(routeKey, page), [controller, routeKey, page])

  return (
    <AnalyticsContext.Provider value={analytics}>
      <ConsentControllerContext.Provider value={value}>
        {children}
      </ConsentControllerContext.Provider>
    </AnalyticsContext.Provider>
  )
}

/** The instance from `<AnalyticsProvider>`, else the one `createAnalytics()` made. */
export function useAnalytics(): Analytics {
  const analytics = useContext(AnalyticsContext) ?? latestAnalytics()
  if (!analytics) throw new Error('useAnalytics needs createAnalytics() to have run, or an AnalyticsProvider above it')
  return analytics
}

/** Current consent, re-rendering when it changes. */
export function useConsent(): {
  consent: ConsentState | null
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
} {
  const analytics = useAnalytics()
  const consent = useSyncExternalStore(
    (listener) => analytics.consent.subscribe(listener),
    () => analytics.consent.getConsent(),
    () => analytics.consent.getConsent(),
  )
  return {
    consent,
    engine: analytics.consent,
    setConsent: (next) => analytics.consent.setConsent(next),
    update: (partial) => analytics.consent.update(partial),
  }
}

/** State and actions for building your own consent UI. */
export function useConsentController(): ConsentControllerValue {
  const value = useContext(ConsentControllerContext)
  if (!value) throw new Error('useConsentController must be used within AnalyticsProvider')
  return value
}
