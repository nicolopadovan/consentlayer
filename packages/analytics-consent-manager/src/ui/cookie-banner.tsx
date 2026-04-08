'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { useConsentController } from '../react/consent-controller'

export function CookieBanner(
  props: Omit<ComponentPropsWithoutRef<'section'>, 'children'>,
) {
  const {
    ready,
    bannerVisible,
    error,
    acceptAll,
    rejectNonEssential,
    openDialog,
  } = useConsentController()

  if (!ready || !bannerVisible) return null

  return (
    <section
      {...props}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acm-cookie-banner-title"
    >
      <h2 id="acm-cookie-banner-title">Cookie preferences</h2>
      <p>
        We use cookies for essential functionality and, with consent, for
        analytics and marketing.
      </p>
      {error ? <p>{error}</p> : null}
      <div>
        <button type="button" onClick={() => void rejectNonEssential()}>
          Reject non-essential
        </button>
        <button type="button" onClick={() => void openDialog()}>
          Customize
        </button>
        <button type="button" onClick={() => void acceptAll()}>
          Accept all
        </button>
      </div>
    </section>
  )
}
