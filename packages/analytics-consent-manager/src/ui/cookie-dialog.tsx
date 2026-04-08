'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { useConsentController } from '../react/consent-controller'

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

  return (
    <section
      {...props}
      role="dialog"
      aria-modal="true"
      aria-labelledby="acm-cookie-dialog-title"
    >
      <h2 id="acm-cookie-dialog-title">Cookie settings</h2>
      <label>
        <input checked disabled type="checkbox" />
        Necessary cookies
      </label>
      <label>
        <input
          checked={prefs.analytics}
          onChange={(event) =>
            setPrefs({ ...prefs, analytics: event.target.checked })
          }
          type="checkbox"
        />
        Analytics cookies
      </label>
      <label>
        <input
          checked={prefs.marketing}
          onChange={(event) =>
            setPrefs({ ...prefs, marketing: event.target.checked })
          }
          type="checkbox"
        />
        Marketing cookies
      </label>
      <div>
        <button type="button" onClick={() => void closeDialog()}>
          Close
        </button>
        <button type="button" onClick={() => void savePreferences()}>
          Save preferences
        </button>
      </div>
    </section>
  )
}
