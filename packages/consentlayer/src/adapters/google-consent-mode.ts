import { getFlag, setFlag } from '../core/plugin'
import type { ConsentIntegrationAdapter, ConsentState } from '../core/types'

export type GoogleConsentModeOptions = {
  /** Categories that count as granted before a choice in the listed ISO 3166-2 regions, e.g. `'US'` or `'US-CA'`. */
  regions?: GoogleConsentModeRegion[]
  /** Milliseconds Google tags wait for a consent update before sending. */
  waitForUpdate?: number
  /** Pass ad click IDs through URLs while `ad_storage` is denied. */
  urlPassthrough?: boolean
  /** Redact ad click data while `ad_storage` is denied. */
  adsDataRedaction?: boolean
}

export type GoogleConsentModeRegion = { region: string[] } & Partial<
  Record<'preferences' | 'analytics' | 'marketing', boolean>
>

const signals = (consent: Partial<Pick<ConsentState, 'preferences' | 'analytics' | 'marketing'>> | null) => ({
  ad_user_data: consent?.marketing ? 'granted' : 'denied',
  ad_personalization: consent?.marketing ? 'granted' : 'denied',
  ad_storage: consent?.marketing ? 'granted' : 'denied',
  analytics_storage: consent?.analytics ? 'granted' : 'denied',
  functionality_storage: consent?.preferences ? 'granted' : 'denied',
  security_storage: 'granted',
})

const REGION = /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/

export function ensureGtag() {
  window.dataLayer = window.dataLayer ?? []
  // gtag.js only executes dataLayer entries that are real `arguments` objects.
  window.gtag =
    window.gtag ??
    function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
}

/** Sets the Consent Mode defaults on the first call, then sends an update for each choice. */
export function consentModeSignals(options: GoogleConsentModeOptions = {}) {
  const { regions = [], waitForUpdate, urlPassthrough, adsDataRedaction } = options
  for (const { region } of regions) {
    if (!region.length || !region.every((code) => REGION.test(code))) {
      throw new Error(`[consentlayer] googleConsentMode regions: ${JSON.stringify(region)} is not a list of ISO 3166-2 codes such as 'US' or 'US-CA'`)
    }
  }
  if (waitForUpdate !== undefined && !(Number.isInteger(waitForUpdate) && waitForUpdate >= 0)) {
    throw new Error(`[consentlayer] googleConsentMode waitForUpdate must be a whole number of milliseconds, received ${waitForUpdate}`)
  }
  const wait = waitForUpdate === undefined ? {} : { wait_for_update: waitForUpdate }
  let defaulted = false
  let sent: string | undefined
  return (consent: ConsentState | null) => {
    if (typeof window === 'undefined') return
    ensureGtag()
    const gtag = window.gtag!
    if (!defaulted) {
      defaulted = true
      gtag('consent', 'default', { ...signals(null), ...wait })
      for (const { region, ...granted } of regions) gtag('consent', 'default', { ...signals(granted), ...wait, region })
      if (urlPassthrough) gtag('set', 'url_passthrough', true)
      if (adsDataRedaction) gtag('set', 'ads_data_redaction', true)
    }
    // Before any choice, the defaults (and their regions) stay in force.
    const update = signals(consent)
    if ((consent || sent) && JSON.stringify(update) !== sent) {
      gtag('consent', 'update', update)
      sent = JSON.stringify(update)
    }
  }
}

/** The signals `ga4()` and `gtm()` send without `googleConsentMode()`; shared, so they go out once. */
export function builtInConsentMode(consent: ConsentState | null) {
  const observe =
    getFlag<ReturnType<typeof consentModeSignals>>('BuiltInConsentMode') ??
    setFlag('BuiltInConsentMode', consentModeSignals())
  observe(consent)
}

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
