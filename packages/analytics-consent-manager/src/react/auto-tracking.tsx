'use client'

import { useEffect, useRef } from 'react'
import { getDefaultRuntimeAnalyticsManager } from '../core/default-runtime'
import type {
  AnalyticsManager as AnalyticsRuntime,
  AutoTrackingConfig,
} from '../core/types'
import { useConsent } from './consent-provider'

export type AutoTrackingProps = {
  manager?: AnalyticsRuntime
  routeKey?: string
  config?: AutoTrackingConfig
}

export function AutoTracking({
  manager,
  routeKey = 'default',
  config,
}: AutoTrackingProps) {
  const runtime = manager ?? getDefaultRuntimeAnalyticsManager()
  const { consent } = useConsent()
  const enabledRef = useRef(false)
  const lastRouteKey = useRef<string | null>(null)
  const lockedConfig = useRef<AutoTrackingConfig | undefined>(config)

  useEffect(() => {
    if (!consent?.analytics) return
    runtime.enableAutoTracking(lockedConfig.current)
    enabledRef.current = true
  }, [consent?.analytics, runtime])

  useEffect(() => {
    if (!enabledRef.current) {
      lastRouteKey.current = routeKey
      return
    }
    if (lastRouteKey.current === null) {
      lastRouteKey.current = routeKey
      return
    }
    if (lastRouteKey.current !== routeKey) {
      runtime.newPageSession()
      lastRouteKey.current = routeKey
    }
  }, [routeKey, runtime])

  return null
}
