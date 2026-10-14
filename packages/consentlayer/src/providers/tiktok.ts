import { definePlugin, getFlag, loadScript, runInlineScript, setFlag, skippedPlugin } from '../core/plugin'
import { sendsToTikTok, tiktokUserData, toTikTokEvent } from '../core/tiktok-events'
import { expireCookies } from '../core/utils'

export { tiktokUserData, toTikTokEvent }

declare global {
  interface Window {
    ttq?: {
      page: () => void
      track: (event: string, params?: Record<string, unknown>, options?: { event_id?: string }) => void
      identify: (data: Record<string, string>) => void
      grantConsent: () => void
      revokeConsent: () => void
    }
  }
}

/** Options for `tiktok`. */
export type TikTokOptions = {
  /** `undefined` or `''` turns the provider off. */
  pixelId: string | undefined
  /**
   * `true`: the pixel script loads at boot and holds events until consent is granted.
   * `false` (default): nothing loads until marketing consent is granted.
   */
  loadBeforeConsent?: boolean
  /** Event names sent to the pixel. Defaults to the events that have a TikTok standard event; custom events are sent only when listed. */
  events?: readonly string[]
}

/** TikTok Pixel, after marketing consent. Pass `server` to `createAnalytics` to also send events to the Events API. */
const isOwnCookie = (name: string) => name === '_ttp' || name === 'ttclid' || name.startsWith('ttcsid')

export function tiktok(options: TikTokOptions) {
  const pixelId = options.pixelId?.trim()
  if (!pixelId) return skippedPlugin('tiktok', 'pixelId')

  const isReady = () =>
    typeof window !== 'undefined' && window.ttq !== undefined && getFlag('TikTokPixelInitialized') === true

  // The pixel keeps identify's email/phone, so after a withdrawal it stays off until reload.
  let matched = false
  let stale = false

  return definePlugin({
    id: 'tiktok',
    requiredConsent: 'marketing',
    loadBeforeConsent: options.loadBeforeConsent ?? false,
    load(loadContext) {
      if (typeof window === 'undefined' || getFlag('TikTokPixelInitialized')) return

      // TikTok's base code with its consent mode methods; loadScript below injects events.js instead of ttq.load.
      runInlineScript(
        `!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{}};
ttq.${loadContext.consent?.marketing ? 'grantConsent' : 'holdConsent'}();
ttq.load(${JSON.stringify(pixelId).replace(/</g, '\\u003c')});
}(window, document, 'ttq');`,
        'tiktok-pixel-bootstrap',
      )
      loadScript(
        `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`,
      ).catch(() =>
        loadContext.emitError({
          scope: 'provider-script-load',
          message: 'Failed to load TikTok Pixel (events.js)',
        }),
      )

      setFlag('TikTokPixelInitialized', true)
    },
    consent(context) {
      if (typeof window !== 'undefined' && context.consent && !context.consent.marketing) expireCookies(isOwnCookie)
      if (!isReady()) return
      if (matched && !context.consent?.marketing) stale = true
      if (context.consent?.marketing && !stale) window.ttq?.grantConsent()
      else window.ttq?.revokeConsent()
    },
    teardown(context) {
      if (typeof window === 'undefined' || context.consent?.marketing) return
      expireCookies(isOwnCookie)
    },
    identify(identity, _traits, context) {
      if (!isReady() || stale || !context.consent?.marketing) return
      const data = tiktokUserData(identity)
      if (!Object.keys(data).length) return
      window.ttq?.identify(data)
      matched ||= Boolean(data.email || data.phone_number)
    },
    page(_page, context) {
      if (!isReady() || stale || !context.consent?.marketing) return
      window.ttq?.page()
    },
    track(event, context) {
      if (
        !isReady() ||
        stale ||
        !context.consent?.marketing ||
        !sendsToTikTok(event.name, options.events, event.options.only)
      )
        return
      const { name, params } = toTikTokEvent(event)
      window.ttq?.track(name, params, { event_id: event.id })
    },
  })
}
