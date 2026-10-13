import type { UserIdentity } from '../core/types'
import { definePlugin, getFlag, loadScript, setFlag } from '../core/plugin'
import { assertValidGa4MeasurementId } from '../core/validation'

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    gtag?: (...args: unknown[]) => void
  }
}

export type Ga4Options = {
  measurementId: string
  /**
   * `true` (default): gtag.js loads at boot with Consent Mode set to denied.
   * `false`: nothing loads until analytics consent is granted.
   */
  loadBeforeConsent?: boolean
}

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

export function ga4(options: Ga4Options) {
  const measurementId = assertValidGa4MeasurementId(options.measurementId)
  const gtag = (...args: unknown[]) => window.gtag?.(...args)
  return definePlugin({
    id: 'ga4',
    requiredConsent: 'analytics',
    loadBeforeConsent: options.loadBeforeConsent ?? true,
    setup() {
      if (typeof window === 'undefined') return
      window.dataLayer = window.dataLayer ?? []
      window.gtag =
        window.gtag ??
        ((...args: unknown[]) => {
          window.dataLayer?.push({ args })
        })
      gtag('consent', 'default', {
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        ad_storage: 'denied',
        analytics_storage: 'denied',
        functionality_storage: 'denied',
        security_storage: 'granted',
      })
      gtag('js', new Date())
    },
    consent({ consent }) {
      if (typeof window === 'undefined') return
      gtag('consent', 'update', {
        ad_user_data: consent?.marketing ? 'granted' : 'denied',
        ad_personalization: consent?.marketing ? 'granted' : 'denied',
        ad_storage: consent?.marketing ? 'granted' : 'denied',
        analytics_storage: consent?.analytics ? 'granted' : 'denied',
        functionality_storage: consent?.preferences ? 'granted' : 'denied',
        security_storage: 'granted',
      })
      // Configured only after consent, so no cookieless pings are sent before it.
      const configured = setFlag(
        'Ga4Configured',
        getFlag<Record<string, boolean>>('Ga4Configured') ?? {},
      )
      if (!consent?.analytics || configured[measurementId]) return
      gtag('config', measurementId, { send_page_view: false })
      configured[measurementId] = true
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
    identify(identity) {
      if (typeof window === 'undefined') return
      if (identity.userId) gtag('set', { user_id: identity.userId })
      gtag('set', 'user_data', ga4UserData(identity))
    },
    reset() {
      if (typeof window === 'undefined') return
      gtag('set', { user_id: null })
      gtag('set', 'user_data', {})
    },
  })
}
