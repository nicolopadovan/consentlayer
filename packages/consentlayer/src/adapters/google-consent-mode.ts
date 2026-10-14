import { consentModeSignals, type GoogleConsentModeOptions } from '../core/consent-mode'
import { setFlag } from '../core/plugin'
import type { ConsentIntegrationAdapter } from '../core/types'

export type { GoogleConsentModeOptions, GoogleConsentModeRegion } from '../core/consent-mode'

/** Sends the visitor's choice to Google tags (GA4, Google Ads, Tag Manager) as Consent Mode v2 signals. */
export function googleConsentMode(options: GoogleConsentModeOptions = {}): ConsentIntegrationAdapter {
  const observe = consentModeSignals(options)
  return {
    id: 'google-consent-mode',
    observe(consent) {
      setFlag('GoogleConsentMode', true)
      observe(consent)
    },
  }
}
