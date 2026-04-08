'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  getDefaultRuntimeAnalyticsManager,
} from '../core/default-runtime'
import type {
  AnalyticsManager as AnalyticsRuntime,
  LazyBootConfig,
  PageViewPayload,
} from '../core/types'
import { useConsent } from './consent-provider'

export type AnalyticsManagerProps = {
  manager?: AnalyticsRuntime
  routeKey?: string
  page?: PageViewPayload
  lazy?: LazyBootConfig
}

function scheduleLazyBoot(
  manager: AnalyticsRuntime,
  lazy: LazyBootConfig | undefined,
): () => void {
  const mode = lazy?.mode ?? 'immediate'
  if (mode === 'manual') return () => undefined
  if (mode === 'immediate') {
    void manager.boot()
    return () => undefined
  }
  if (
    typeof window !== 'undefined' &&
    'requestIdleCallback' in window
  ) {
    const handle = window.requestIdleCallback(
      () => void manager.boot(),
      { timeout: lazy?.timeoutMs ?? 3000 },
    )
    return () => window.cancelIdleCallback?.(handle)
  }
  if (typeof window === 'undefined') {
    void manager.boot()
    return () => undefined
  }
  const timeout = globalThis.setTimeout(
    () => void manager.boot(),
    lazy?.timeoutMs ?? 1500,
  )
  return () => globalThis.clearTimeout(timeout)
}

export function AnalyticsManager({
  manager,
  routeKey = 'default',
  page,
  lazy,
}: AnalyticsManagerProps) {
  const runtime = manager ?? getDefaultRuntimeAnalyticsManager()
  const { consent } = useConsent()
  const snapshot = useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getSnapshot(),
    () => runtime.getSnapshot(),
  )
  const lastTrackedRouteKey = useRef<string | null>(null)
  const [pageRef] = useState(() => page)

  useEffect(() => scheduleLazyBoot(runtime, lazy), [lazy, runtime])

  useEffect(() => {
    void runtime.updateConsent(consent)
  }, [consent, runtime])

  useEffect(() => {
    if (!snapshot.booted) return
    if (snapshot.activeProviders.length === 0) return
    if (lastTrackedRouteKey.current === routeKey) return
    void runtime.trackPage(pageRef ?? page)
    lastTrackedRouteKey.current = routeKey
  }, [page, pageRef, routeKey, runtime, snapshot.activeProviders, snapshot.booted])

  return null
}
