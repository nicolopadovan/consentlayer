'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { getNames, ui } from '../core/names'
import { useConsentController } from '../react/consent-controller'
import { useConsentMessages } from './messages'

function cx(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

const CATEGORIES = ['necessary', 'preferences', 'analytics', 'marketing'] as const

/** The per-category consent dialog. */
export function CookieDialog(
  props: Omit<ComponentPropsWithoutRef<'section'>, 'children'>,
) {
  const {
    ready,
    dialogVisible,
    closeDialog,
    prefs,
    setPrefs,
    savePreferences,
  } = useConsentController()
  const { messages, privacyPolicyUrl } = useConsentMessages()

  if (!ready || !dialogVisible) return null

  const { className, ...rest } = props
  const id = `${getNames().classPrefix}-cookie-dialog`

  return (
    <section
      {...rest}
      className={cx(ui('dialog'), className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className={ui('dialog__title')}>
        {messages.dialogTitle}
      </h2>
      {CATEGORIES.map((category) => (
        <label key={category} className={ui('dialog__option')}>
          <input
            className={ui('dialog__checkbox')}
            type="checkbox"
            aria-labelledby={`${id}-${category}`}
            aria-describedby={`${id}-${category}-description`}
            {...(category === 'necessary'
              ? { checked: true, disabled: true }
              : {
                  checked: prefs[category],
                  onChange: (event) => setPrefs({ ...prefs, [category]: event.target.checked }),
                })}
          />
          <span className={ui('dialog__option-text')}>
            <span id={`${id}-${category}`} className={ui('dialog__option-label')}>
              {messages[`${category}Label`]}
            </span>
            <span id={`${id}-${category}-description`} className={ui('dialog__option-description')}>
              {messages[`${category}Description`]}
            </span>
          </span>
        </label>
      ))}
      {privacyPolicyUrl ? (
        <a className={ui('dialog__link')} href={privacyPolicyUrl}>
          {messages.privacyPolicy}
        </a>
      ) : null}
      <div className={ui('dialog__actions')}>
        <button
          type="button"
          className={ui('dialog__button', 'dialog__button--secondary')}
          onClick={() => void closeDialog()}
        >
          {messages.close}
        </button>
        <button
          type="button"
          className={ui('dialog__button', 'dialog__button--primary')}
          onClick={() => void savePreferences()}
        >
          {messages.save}
        </button>
      </div>
    </section>
  )
}
