'use client'

import { AnalyticsProvider } from 'consentlayer/react'
import {
  CookieBanner,
  CookieDialog,
  ManageConsentTrigger,
} from 'consentlayer/ui'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'

const idleBoot = { mode: 'idle', timeoutMs: 3000 } as const

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <AnalyticsProvider
      analytics={analytics}
      boot={idleBoot}
      routeKey={`${pathname}?${searchParams.toString()}`}
    >
      <CookieBanner className="banner" />
      <CookieDialog className="dialog" />
      <ManageConsentTrigger className="button manage" />
      {children}
    </AnalyticsProvider>
  )
}
