'use client'

import type { ConsentCategory } from 'consentlayer'
import { useConsentController } from 'consentlayer/react'
import './consent-banner.css'

const categories: Record<ConsentCategory, { label: string; description: string }> = {
  preferences: { label: 'Preferences', description: 'Remember settings such as language or region.' },
  analytics: { label: 'Analytics', description: 'Help us understand how the site is used.' },
  marketing: { label: 'Marketing', description: 'Measure our ads and show relevant ones on other sites.' },
  functional: { label: 'Functional', description: 'Enable extras such as the support chat.' },
}

export function ConsentBanner({ privacyPolicyUrl }: { privacyPolicyUrl?: string }) {
  const consent = useConsentController()
  if (!consent.ready) return null

  if (consent.dialogVisible) {
    return (
      <section className="consent-dialog" role="dialog" aria-labelledby="consent-dialog-title">
        <h2 id="consent-dialog-title">Cookie settings</h2>
        <label>
          <input type="checkbox" checked disabled />
          <span>
            <strong>Necessary</strong> Needed for the site to work, such as remembering this choice. Always on.
          </span>
        </label>
        {consent.categories.map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={consent.prefs[key]}
              onChange={(event) => consent.setPrefs({ ...consent.prefs, [key]: event.target.checked })}
            />
            <span>
              <strong>{categories[key].label}</strong> {categories[key].description}
            </span>
          </label>
        ))}
        <div className="consent-actions">
          <button type="button" onClick={consent.closeDialog}>
            Close
          </button>
          <button type="button" className="primary" onClick={() => void consent.savePreferences()}>
            Save
          </button>
        </div>
      </section>
    )
  }

  if (!consent.bannerVisible) return null
  return (
    <section className="consent-banner" role="dialog" aria-labelledby="consent-banner-title">
      <h2 id="consent-banner-title">Cookies</h2>
      <p>
        We use cookies to run this site and, with your consent, for preferences, analytics and marketing.
        {privacyPolicyUrl && (
          <>
            {' '}
            <a href={privacyPolicyUrl}>Privacy policy</a>
          </>
        )}
      </p>
      <div className="consent-actions">
        <button type="button" onClick={() => void consent.rejectNonEssential()}>
          Reject non-essential
        </button>
        <button type="button" onClick={consent.openDialog}>
          Customize
        </button>
        <button type="button" className="primary" onClick={() => void consent.acceptAll()}>
          Accept all
        </button>
      </div>
    </section>
  )
}
