'use client'

import { AnalyticsProvider, useConsentController } from 'consentlayer/react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'
import { ConsentBanner } from './consent-banner'

const idleBoot = { mode: 'idle', timeoutMs: 3000 } as const

function CookieSettingsButton() {
  const { openDialog, bannerVisible } = useConsentController()
  if (bannerVisible) return null
  return (
    <button type="button" className="button manage" onClick={openDialog}>
      Cookie settings
    </button>
  )
}

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <AnalyticsProvider
      analytics={analytics}
      boot={idleBoot}
      routeKey={`${pathname}?${searchParams.toString()}`}
    >
      <ConsentBanner />
      <CookieSettingsButton />
      {children}
    </AnalyticsProvider>
  )
}
