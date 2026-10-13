import type { ConsentState, UserIdentity } from '../core/types'
import { definePlugin, getFlag, loadScript, setFlag, skippedPlugin } from '../core/plugin'
import { assertValidGa4MeasurementId } from '../core/validation'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** Options for `ga4`. */
export type Ga4Options = {
  /** `undefined` or `''` turns the provider off. */
  measurementId: string | undefined
  /**
   * `true`: gtag.js loads at boot with Consent Mode set to denied.
   * `false` (default): nothing loads until analytics consent is granted.
   */
  loadBeforeConsent?: boolean
  consentMode?: Ga4ConsentMode
}

type Ga4ConsentSettings = {
  /** Milliseconds gtag waits for a consent update before sending. */
  waitForUpdate?: number
  /** Pass ad click IDs through URLs while `ad_storage` is denied. */
  urlPassthrough?: boolean
  /** Redact ad click data while `ad_storage` is denied. */
  adsDataRedaction?: boolean
}

/** Categories that count as granted before a choice in the listed ISO 3166-2 regions, e.g. `'US'` or `'US-CA'`. */
export type Ga4RegionDefault = { region: string[] } & Partial<
  Record<'preferences' | 'analytics' | 'marketing', boolean>
>

/**
 * `'basic'` (default): the tag is configured once analytics is granted.
 * `'advanced'`: the tag loads and is configured at boot, so Google receives
 * cookieless pings while consent is denied; `regions` sets defaults per region.
 */
export type Ga4ConsentMode =
  | (Ga4ConsentSettings & { mode?: 'basic'; regions?: never })
  | (Ga4ConsentSettings & { mode: 'advanced'; regions?: Ga4RegionDefault[] })

const GA4_EVENT_NAMES: Record<string, string> = {
  lead: 'generate_lead',
}

const signals = (consent: Partial<Pick<ConsentState, 'preferences' | 'analytics' | 'marketing'>> | null) => ({
  ad_user_data: consent?.marketing ? 'granted' : 'denied',
  ad_personalization: consent?.marketing ? 'granted' : 'denied',
  ad_storage: consent?.marketing ? 'granted' : 'denied',
  analytics_storage: consent?.analytics ? 'granted' : 'denied',
  functionality_storage: consent?.preferences ? 'granted' : 'denied',
  security_storage: 'granted',
})

const REGION = /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/

/** GA4 event names allow only letters, digits and underscores. */
export function ga4EventName(name: string): string {
  return GA4_EVENT_NAMES[name] ?? name.replace(/[^A-Za-z0-9_]/g, '_')
}

/** User-provided data; empty when there is no email or phone to share. */
export function ga4UserData(identity: UserIdentity): Record<string, string> {
  const data: Record<string, string> = {}
  if (identity.email) data.email = identity.email
  if (identity.phone) data.phone_number = identity.phone.startsWith('+') ? identity.phone : `+${identity.phone}`
  return data
}

/** Google Analytics 4 via gtag.js, with Consent Mode v2. Needs analytics consent; ad signals follow marketing consent. */
export function ga4(options: Ga4Options) {
  if (!options.measurementId?.trim()) return skippedPlugin('ga4', 'measurementId')
  const measurementId = assertValidGa4MeasurementId(options.measurementId.trim())
  const { mode = 'basic', regions = [], waitForUpdate, urlPassthrough, adsDataRedaction } = options.consentMode ?? {}
  const advanced = mode === 'advanced'
  if (regions.length && !advanced) throw new Error("[consentlayer] ga4 consentMode.regions needs mode: 'advanced'")
  for (const { region } of regions) {
    if (!region.length || !region.every((code) => REGION.test(code))) {
      throw new Error(`[consentlayer] ga4 consentMode.regions: ${JSON.stringify(region)} is not a list of ISO 3166-2 codes such as 'US' or 'US-CA'`)
    }
  }
  if (waitForUpdate !== undefined && !(Number.isInteger(waitForUpdate) && waitForUpdate >= 0)) {
    throw new Error(`[consentlayer] ga4 consentMode.waitForUpdate must be a whole number of milliseconds, received ${waitForUpdate}`)
  }
  const wait = waitForUpdate === undefined ? {} : { wait_for_update: waitForUpdate }
  const gtag = (...args: unknown[]) => window.gtag?.(...args)
  const configure = () => {
    const configured = setFlag('Ga4Configured', getFlag<Record<string, boolean>>('Ga4Configured') ?? {})
    if (configured[measurementId]) return
    gtag('config', measurementId, { send_page_view: false })
    configured[measurementId] = true
  }
  const applyIdentity = (identity: UserIdentity) => {
    gtag('set', { user_id: identity.userId ?? null })
    gtag('set', 'user_data', ga4UserData(identity))
  }
  let updated = false
  return definePlugin({
    id: 'ga4',
    requiredConsent: advanced ? 'none' : 'analytics',
    loadBeforeConsent: advanced || (options.loadBeforeConsent ?? false),
    setup() {
      if (typeof window === 'undefined') return
      window.dataLayer = window.dataLayer ?? []
      // gtag.js only executes dataLayer entries that are real `arguments` objects.
      window.gtag =
        window.gtag ??
        function gtag() {
          // eslint-disable-next-line prefer-rest-params
          window.dataLayer?.push(arguments)
        }
      gtag('consent', 'default', { ...signals(null), ...wait })
      for (const { region, ...granted } of regions) gtag('consent', 'default', { ...signals(granted), ...wait, region })
      if (urlPassthrough) gtag('set', 'url_passthrough', true)
      if (adsDataRedaction) gtag('set', 'ads_data_redaction', true)
      gtag('js', new Date())
      if (advanced) configure()
    },
    consent({ consent, identity }) {
      if (typeof window === 'undefined') return
      // Before any choice, the defaults (and their regions) stay in force.
      if (consent || updated) {
        gtag('consent', 'update', signals(consent))
        updated = true
      }
      if (advanced) applyIdentity(consent?.analytics ? identity : {})
      // In basic mode, configured only after consent, so no cookieless pings are sent before it.
      else if (consent?.analytics) configure()
    },
    load({ emitError }) {
      if (typeof window === 'undefined') return
      loadScript(
        `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
      ).catch(() =>
        emitError({
          scope: 'provider-script-load',
          message: `Failed to load GA4 gtag.js for measurement ID ${measurementId}`,
        }),
      )
    },
    page(page) {
      if (typeof window === 'undefined') return
      gtag('event', 'page_view', {
        page_location: page.url ?? window.location.href,
        page_path: page.path ?? window.location.pathname,
        page_title: page.title ?? document.title,
      })
    },
    track(event) {
      if (typeof window === 'undefined') return
      gtag('event', ga4EventName(event.name), {
        ...event.params,
        ...event.options.providers?.ga4,
      })
    },
    identify(identity, _traits, { consent }) {
      if (typeof window === 'undefined' || (advanced && !consent?.analytics)) return
      if (identity.userId) gtag('set', { user_id: identity.userId })
      gtag('set', 'user_data', ga4UserData(identity))
    },
    reset() {
      if (typeof window === 'undefined') return
      applyIdentity({})
    },
  })
}
