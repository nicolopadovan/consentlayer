'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { getNames, ui } from '../core/names'
import { useConsentController } from '../react/consent-controller'
import { useConsentMessages } from './messages'

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
  const { messages, privacyPolicyUrl } = useConsentMessages()

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
        {messages.bannerTitle}
      </h2>
      <p className={ui('banner__description')}>
        {messages.bannerDescription}
        {privacyPolicyUrl ? (
          <>
            {' '}
            <a className={ui('banner__link')} href={privacyPolicyUrl}>
              {messages.privacyPolicy}
            </a>
          </>
        ) : null}
      </p>
      {error ? <p className={ui('banner__error')}>{error}</p> : null}
      <div className={ui('banner__actions')}>
        <button
          type="button"
          className={ui('banner__button', 'banner__button--secondary')}
          onClick={() => void rejectNonEssential()}
        >
          {messages.rejectNonEssential}
        </button>
        <button
          type="button"
          className={ui('banner__button', 'banner__button--secondary')}
          onClick={() => void openDialog()}
        >
          {messages.customize}
        </button>
        <button
          type="button"
          className={ui('banner__button', 'banner__button--primary')}
          onClick={() => void acceptAll()}
        >
          {messages.acceptAll}
        </button>
      </div>
    </section>
  )
}
