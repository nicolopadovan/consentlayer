'use client'

import { AnalyticsProvider } from 'consentlayer/next'
import { useConsentController } from 'consentlayer/react'
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
  return (
    <AnalyticsProvider analytics={analytics} boot={idleBoot}>
      <ConsentBanner />
      <CookieSettingsButton />
      {children}
    </AnalyticsProvider>
  )
}
