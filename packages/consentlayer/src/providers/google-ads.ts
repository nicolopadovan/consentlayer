import { builtInConsentMode, ensureGtag, loadGtag } from '../core/consent-mode'
import { definePlugin, getFlag, setFlag, skippedPlugin } from '../core/plugin'
import type { EventName, LoadTiming } from '../core/types'
import { expireCookies } from '../core/utils'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** Options for `googleAds`. */
export type GoogleAdsOptions = {
  /** The Google Ads tag ID, e.g. `AW-123456789`; `undefined` or `''` turns the provider off. */
  conversionId: string | undefined
  /** Conversion labels keyed by the event name passed to `track()`. Other events are not sent. */
  events?: Partial<Record<EventName, string>>
  /** Sends a `page_view` for remarketing on every page. Defaults to `true`. */
  pageViews?: boolean
  defer?: LoadTiming
}

const CONVERSION_ID = /^AW-\d+$/

/** Google Ads conversions and remarketing via gtag.js, with Consent Mode v2. Needs marketing consent. */
export function googleAds(options: GoogleAdsOptions) {
  if (!options.conversionId?.trim()) return skippedPlugin('google-ads', 'conversionId')
  const conversionId = options.conversionId.trim()
  if (!CONVERSION_ID.test(conversionId)) {
    throw new Error(
      `[consentlayer] Invalid Google Ads conversion ID: expected format "AW-123456789", received "${conversionId}".`,
    )
  }
  const labels: Partial<Record<string, string>> = options.events ?? {}
  let ownConsentMode = false
  const gtag = (...args: unknown[]) => window.gtag?.(...args)
  return definePlugin({
    id: 'google-ads',
    requiredConsent: 'marketing',
    defer: options.defer,
    events: options.events ? Object.keys(options.events) : false,
    setup() {
      if (typeof window === 'undefined') return
      ownConsentMode = !getFlag('GoogleConsentMode')
      if (ownConsentMode) builtInConsentMode(null)
      else ensureGtag()
    },
    consent({ consent }) {
      if (typeof window === 'undefined') return
      if (ownConsentMode) builtInConsentMode(consent)
      if (consent && !consent.marketing) expireCookies((name) => name.startsWith('_gcl_'))
    },
    load({ emitError }) {
      if (typeof window === 'undefined') return
      const configured = setFlag('GoogleAdsConfigured', getFlag<Record<string, boolean>>('GoogleAdsConfigured') ?? {})
      if (configured[conversionId]) return
      configured[conversionId] = true
      if (!window.dataLayer?.some((entry) => (entry as ArrayLike<unknown>)[0] === 'js')) gtag('js', new Date())
      gtag('config', conversionId, { send_page_view: false })
      loadGtag(conversionId).catch(() =>
        emitError({
          scope: 'provider-script-load',
          message: `Failed to load gtag.js for Google Ads ${conversionId}`,
        }),
      )
    },
    page(page) {
      if (typeof window === 'undefined' || options.pageViews === false) return
      gtag('event', 'page_view', {
        page_location: page.url ?? window.location.href,
        page_path: page.path ?? window.location.pathname,
        page_title: page.title ?? document.title,
        send_to: conversionId,
      })
    },
    track(event) {
      const label = labels[event.name]
      if (typeof window === 'undefined' || !label) return
      const { value, currency, transaction_id } = event.params
      gtag('event', 'conversion', {
        ...(value !== undefined && { value }),
        ...(currency !== undefined && { currency }),
        ...(transaction_id !== undefined && { transaction_id }),
        ...event.options.providers?.['google-ads'],
        send_to: `${conversionId}/${label}`,
      })
    },
  })
}
