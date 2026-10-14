import { builtInConsentMode, ensureGtag, loadGtag } from '../core/consent-mode'
import type { EventName, UserIdentity } from '../core/types'
import { definePlugin, getFlag, setFlag, skippedPlugin } from '../core/plugin'
import { expireCookies } from '../core/utils'
import { assertHttpsOrRelativeUrl, assertValidGa4MeasurementId } from '../core/validation'

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
  /** Your tagging server, e.g. `https://sgtm.example.com`: hits go to it instead of Google. */
  serverContainerUrl?: string
  /** Event names `track` sends to it: all by default, none with `false`. */
  events?: readonly EventName[] | false
}

/**
 * `'basic'` (default): the tag is configured once analytics is granted.
 * `'advanced'`: the tag loads and is configured at boot, so Google receives
 * cookieless pings while consent is denied.
 */
export type Ga4ConsentMode = 'basic' | 'advanced'

const GA4_EVENT_NAMES: Record<string, string> = {
  lead: 'generate_lead',
}

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
  const advanced = options.consentMode === 'advanced'
  const serverContainerUrl =
    options.serverContainerUrl && assertHttpsOrRelativeUrl(options.serverContainerUrl, 'ga4 serverContainerUrl')
  let ownConsentMode = false
  const gtag = (...args: unknown[]) => window.gtag?.(...args)
  const configure = () => {
    const configured = setFlag('Ga4Configured', getFlag<Record<string, boolean>>('Ga4Configured') ?? {})
    if (configured[measurementId]) return
    gtag('config', measurementId, {
      send_page_view: false,
      ...(serverContainerUrl && { server_container_url: serverContainerUrl }),
    })
    configured[measurementId] = true
  }
  const applyIdentity = (identity: UserIdentity) => {
    gtag('set', { user_id: identity.userId ?? null })
    gtag('set', 'user_data', ga4UserData(identity))
  }
  return definePlugin({
    id: 'ga4',
    events: options.events,
    requiredConsent: advanced ? 'none' : 'analytics',
    loadBeforeConsent: advanced || (options.loadBeforeConsent ?? false),
    setup() {
      if (typeof window === 'undefined') return
      ownConsentMode = !getFlag('GoogleConsentMode')
      if (ownConsentMode) builtInConsentMode(null)
      else ensureGtag()
      gtag('js', new Date())
      if (advanced) configure()
    },
    consent({ consent, identity }) {
      if (typeof window === 'undefined') return
      if (ownConsentMode) builtInConsentMode(consent)
      if (consent && !consent.analytics)
        expireCookies((name) => name === '_ga' || name === '_gid' || name.startsWith('_ga_'))
      if (advanced) applyIdentity(consent?.analytics ? identity : {})
      // In basic mode, configured only after consent, so no cookieless pings are sent before it.
      else if (consent?.analytics) configure()
    },
    load({ emitError }) {
      if (typeof window === 'undefined') return
      loadGtag(measurementId).catch(() =>
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
        send_to: measurementId,
      })
    },
    track(event) {
      if (typeof window === 'undefined') return
      gtag('event', ga4EventName(event.name), {
        ...event.params,
        ...event.options.providers?.ga4,
        send_to: measurementId,
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
