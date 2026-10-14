import type { ConsentCategory } from 'consentlayer'
import { useConsentController } from 'consentlayer/solidstart'
import { For, Show } from 'solid-js'
import './consent-banner.css'

const labels: Record<ConsentCategory, { label: string; description: string }> = {
  preferences: { label: 'Preferences', description: 'Remember settings such as language or region.' },
  analytics: { label: 'Analytics', description: 'Help us understand how the site is used.' },
  marketing: { label: 'Marketing', description: 'Measure our ads and show relevant ones on other sites.' },
}

export function ConsentBanner(props: { privacyPolicyUrl?: string }) {
  const consent = useConsentController()

  return (
    <Show when={consent.ready}>
      <Show
        when={consent.dialogVisible}
        fallback={
          <Show when={consent.bannerVisible}>
            <div class="consent-banner" role="dialog" aria-labelledby="consent-banner-title">
              <h2 id="consent-banner-title">Cookies</h2>
              <p>
                We use cookies to run this site and, with your consent, for preferences, analytics and marketing.{' '}
                <Show when={props.privacyPolicyUrl}>
                  <a href={props.privacyPolicyUrl}>Privacy policy</a>
                </Show>
              </p>
              <div class="consent-actions">
                <button type="button" onClick={() => void consent.rejectNonEssential()}>
                  Reject non-essential
                </button>
                <button type="button" onClick={() => consent.openDialog()}>
                  Customize
                </button>
                <button type="button" class="primary" onClick={() => void consent.acceptAll()}>
                  Accept all
                </button>
              </div>
            </div>
          </Show>
        }
      >
        <div class="consent-dialog" role="dialog" aria-labelledby="consent-dialog-title">
          <h2 id="consent-dialog-title">Cookie settings</h2>
          <label>
            <input type="checkbox" checked disabled />
            <span>
              <strong>Necessary</strong> Needed for the site to work, such as remembering this choice. Always on.
            </span>
          </label>
          <For each={consent.categories}>
            {(key) => (
              <label>
                <input
                  type="checkbox"
                  checked={consent.prefs[key]}
                  onChange={(event) => consent.setPrefs({ ...consent.prefs, [key]: event.currentTarget.checked })}
                />
                <span>
                  <strong>{labels[key].label}</strong> {labels[key].description}
                </span>
              </label>
            )}
          </For>
          <div class="consent-actions">
            <button type="button" onClick={() => consent.closeDialog()}>
              Close
            </button>
            <button type="button" class="primary" onClick={() => void consent.savePreferences()}>
              Save
            </button>
          </div>
        </div>
      </Show>
    </Show>
  )
}
