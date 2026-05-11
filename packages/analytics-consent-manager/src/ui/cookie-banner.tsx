'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { useConsentController } from '../react/consent-controller'

function cx(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

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

  const { className, ...rest } = props

  return (
    <section
      {...rest}
      className={cx('acm-banner', className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acm-cookie-banner-title"
    >
      <h2 id="acm-cookie-banner-title" className="acm-banner__title">
        Cookie preferences
      </h2>
      <p className="acm-banner__description">
        We use cookies for essential functionality and, with consent, for
        analytics and marketing.
      </p>
      {error ? <p className="acm-banner__error">{error}</p> : null}
      <div className="acm-banner__actions">
        <button
          type="button"
          className="acm-banner__button acm-banner__button--secondary"
          onClick={() => void rejectNonEssential()}
        >
          Reject non-essential
        </button>
        <button
          type="button"
          className="acm-banner__button acm-banner__button--secondary"
          onClick={() => void openDialog()}
        >
          Customize
        </button>
        <button
          type="button"
          className="acm-banner__button acm-banner__button--primary"
          onClick={() => void acceptAll()}
        >
          Accept all
        </button>
      </div>
    </section>
  )
}
