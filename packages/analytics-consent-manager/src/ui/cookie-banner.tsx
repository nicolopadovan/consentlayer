'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { getNames, ui } from '../core/names'
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
      className={cx(ui('banner'), className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${getNames().classPrefix}-cookie-banner-title`}
    >
      <h2 id={`${getNames().classPrefix}-cookie-banner-title`} className={ui('banner__title')}>
        Cookie preferences
      </h2>
      <p className={ui('banner__description')}>
        We use cookies for essential functionality and, with consent, for
        analytics and marketing.
      </p>
      {error ? <p className={ui('banner__error')}>{error}</p> : null}
      <div className={ui('banner__actions')}>
        <button
          type="button"
          className={ui('banner__button', 'banner__button--secondary')}
          onClick={() => void rejectNonEssential()}
        >
          Reject non-essential
        </button>
        <button
          type="button"
          className={ui('banner__button', 'banner__button--secondary')}
          onClick={() => void openDialog()}
        >
          Customize
        </button>
        <button
          type="button"
          className={ui('banner__button', 'banner__button--primary')}
          onClick={() => void acceptAll()}
        >
          Accept all
        </button>
      </div>
    </section>
  )
}
