'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { getNames, ui } from '../core/names'
import { useConsentController } from '../react/consent-controller'

function cx(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

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

  if (!ready || !dialogVisible) return null

  const { className, ...rest } = props

  return (
    <section
      {...rest}
      className={cx(ui('dialog'), className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${getNames().classPrefix}-cookie-dialog-title`}
    >
      <h2 id={`${getNames().classPrefix}-cookie-dialog-title`} className={ui('dialog__title')}>
        Cookie settings
      </h2>
      <label className={ui('dialog__option')}>
        <input
          className={ui('dialog__checkbox')}
          checked
          disabled
          type="checkbox"
        />
        <span className={ui('dialog__option-label')}>Necessary cookies</span>
      </label>
      <label className={ui('dialog__option')}>
        <input
          className={ui('dialog__checkbox')}
          checked={prefs.analytics}
          onChange={(event) =>
            setPrefs({ ...prefs, analytics: event.target.checked })
          }
          type="checkbox"
        />
        <span className={ui('dialog__option-label')}>Analytics cookies</span>
      </label>
      <label className={ui('dialog__option')}>
        <input
          className={ui('dialog__checkbox')}
          checked={prefs.marketing}
          onChange={(event) =>
            setPrefs({ ...prefs, marketing: event.target.checked })
          }
          type="checkbox"
        />
        <span className={ui('dialog__option-label')}>Marketing cookies</span>
      </label>
      <div className={ui('dialog__actions')}>
        <button
          type="button"
          className={ui('dialog__button', 'dialog__button--secondary')}
          onClick={() => void closeDialog()}
        >
          Close
        </button>
        <button
          type="button"
          className={ui('dialog__button', 'dialog__button--primary')}
          onClick={() => void savePreferences()}
        >
          Save preferences
        </button>
      </div>
    </section>
  )
}
