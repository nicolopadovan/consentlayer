'use client'

import { useMemo } from 'react'
import { getDefaultRuntimeAnalyticsManager } from '../core/default-runtime'
import type {
  AnalyticsManager as AnalyticsRuntime,
  PageViewPayload,
  TrackEventOptions,
} from '../core/types'

export type Tracker = {
  trackEvent: (
    name: string,
    params?: Record<string, unknown>,
    options?: TrackEventOptions,
  ) => Promise<void>
  trackPage: (payload?: PageViewPayload) => Promise<void>
  newPageSession: () => void
}

export function useTracker(manager?: AnalyticsRuntime): Tracker {
  const runtime = manager ?? getDefaultRuntimeAnalyticsManager()
  return useMemo(
    () => ({
      trackEvent: (name, params, options) =>
        runtime.trackEvent(name, params, options),
      trackPage: (payload) => runtime.trackPage(payload),
      newPageSession: () => runtime.newPageSession(),
    }),
    [runtime],
  )
}
