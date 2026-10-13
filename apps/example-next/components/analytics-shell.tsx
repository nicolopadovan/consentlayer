'use client'

import { AnalyticsProvider } from '@nicolopadovan/analytics-consent-manager/react'
import {
  CookieBanner,
  CookieDialog,
  ManageConsentTrigger,
} from '@nicolopadovan/analytics-consent-manager/ui'
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
