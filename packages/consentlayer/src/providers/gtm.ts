import { builtInConsentMode, ensureGtag } from '../core/consent-mode'
import { definePlugin, getFlag, loadScript, setFlag, skippedPlugin } from '../core/plugin'
import type { ConsentState, ProviderConsentRequirement } from '../core/types'
import { assertHttpsOrRelativeUrl } from '../core/validation'

/** Options for `gtm`. */
export type GtmOptions = {
  /** `undefined` or `''` turns the provider off. */
  containerId: string | undefined
  /**
   * `'none'` (default): the container loads at boot and its tags follow
   * Consent Mode. A category: nothing loads until it is granted.
   */
  requiredConsent?: ProviderConsentRequirement
  /** Your tagging server, e.g. `https://sgtm.example.com`: `gtm.js` loads from it instead of Google. */
  serverContainerUrl?: string
}

const GTM_CONTAINER_ID = /^GTM-[A-Z0-9]{4,12}$/

/** Google Tag Manager. Feeds page views, events, the user ID and consent into `dataLayer`. */
export function gtm(options: GtmOptions) {
  if (!options.containerId?.trim()) return skippedPlugin('gtm', 'containerId')
  const containerId = options.containerId.trim()
  if (!GTM_CONTAINER_ID.test(containerId)) {
    throw new Error(
      `[consentlayer] Invalid GTM container ID: expected format "GTM-XXXXXXX", received "${containerId}".`,
    )
  }
  const origin = options.serverContainerUrl
    ? assertHttpsOrRelativeUrl(options.serverContainerUrl, 'gtm serverContainerUrl').replace(/\/$/, '')
    : 'https://www.googletagmanager.com'
  let ownConsentMode = false
  let userId: string | null = null
  let consented: ConsentState | null = null
  const push = (message: Record<string, unknown>) => window.dataLayer?.push(message)
  const pushUserId = (next: string | undefined) => {
    if ((next ?? null) === userId) return
    userId = next ?? null
    push({ event: 'consentlayer_identify', user_id: userId })
  }
  return definePlugin({
    id: 'gtm',
    requiredConsent: options.requiredConsent ?? 'none',
    setup() {
      if (typeof window === 'undefined') return
      ownConsentMode = !getFlag('GoogleConsentMode')
      if (ownConsentMode) builtInConsentMode(null)
      else ensureGtag()
    },
    consent({ consent, identity }) {
      if (typeof window === 'undefined') return
      if (ownConsentMode) builtInConsentMode(consent)
      if (consent && JSON.stringify(consent) !== JSON.stringify(consented)) {
        consented = consent
        push({ event: 'consentlayer_consent', consent: { ...consent } })
      }
      pushUserId(consent?.analytics ? identity.userId : undefined)
    },
    load({ emitError }) {
      if (typeof window === 'undefined') return
      const loaded = setFlag('GtmLoaded', getFlag<Record<string, boolean>>('GtmLoaded') ?? {})
      if (loaded[containerId]) return
      loaded[containerId] = true
      push({ 'gtm.start': Date.now(), event: 'gtm.js' })
      loadScript(`${origin}/gtm.js?id=${encodeURIComponent(containerId)}`).catch(() =>
        emitError({
          scope: 'provider-script-load',
          message: `Failed to load Google Tag Manager container ${containerId}`,
        }),
      )
    },
    page(page) {
      if (typeof window === 'undefined') return
      push({
        event: 'page_view',
        page_location: page.url ?? window.location.href,
        page_path: page.path ?? window.location.pathname,
        page_title: page.title ?? document.title,
      })
    },
    track(event) {
      if (typeof window === 'undefined') return
      push({ ...event.params, ...event.options.providers?.gtm, event: event.name })
    },
    identify(identity, _traits, { consent }) {
      if (typeof window === 'undefined' || !consent?.analytics) return
      pushUserId(identity.userId)
    },
    reset() {
      if (typeof window === 'undefined') return
      pushUserId(undefined)
    },
  })
}
