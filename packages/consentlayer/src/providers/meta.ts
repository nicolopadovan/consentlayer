import { metaUserData, toMetaEvent } from '../core/meta-events'
import { definePlugin, getFlag, loadScript, setFlag } from '../core/plugin'
import { assertValidMetaPixelId } from '../core/validation'

export { metaUserData, toMetaEvent }

declare global {
  interface Window {
    fbq?: (
      method: string,
      eventNameOrPixelId?: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string },
    ) => void
    _fbq?: typeof window.fbq
  }
}

export type MetaOptions = {
  pixelId: string
  locale?: string
  /**
   * `true`: the pixel script loads at boot and is told consent is revoked.
   * `false` (default): nothing loads until marketing consent is granted.
   */
  loadBeforeConsent?: boolean
}

export function meta(options: MetaOptions) {
  const pixelId = assertValidMetaPixelId(options.pixelId)
  const locale = options.locale ?? 'en_US'

  const isReady = () =>
    typeof window !== 'undefined' &&
    typeof window.fbq === 'function' &&
    getFlag('MetaPixelInitialized') === true

  // The pixel keeps init's email/phone, so after a withdrawal it stays off until reload.
  let matched = false
  let stale = false

  return definePlugin({
    id: 'meta',
    requiredConsent: 'marketing',
    loadBeforeConsent: options.loadBeforeConsent ?? false,
    load(loadContext) {
      if (typeof window === 'undefined' || getFlag('MetaPixelInitialized')) return

      const bootstrap = document.createElement('script')
      bootstrap.setAttribute(
        'data-consentlayer',
        'meta-pixel-bootstrap',
      )
      bootstrap.text = `!function(f,b,e,v,n){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window);
fbq('consent', ${loadContext.consent?.marketing ? "'grant'" : "'revoke'"});
fbq('init', ${JSON.stringify(pixelId)}, ${JSON.stringify(metaUserData(loadContext.identity)).replace(/</g, '\\u003c')});`
      document.head.appendChild(bootstrap)
      bootstrap.remove()
      matched = Boolean(loadContext.identity.email || loadContext.identity.phone)
      loadScript(`https://connect.facebook.net/${encodeURIComponent(locale)}/fbevents.js`).catch(
        () =>
          loadContext.emitError({
            scope: 'provider-script-load',
            message: 'Failed to load Meta Pixel (fbevents.js)',
          }),
      )

      setFlag('MetaPixelInitialized', true)
    },
    consent(context) {
      if (!isReady()) return
      if (matched && !context.consent?.marketing) stale = true
      window.fbq?.('consent', context.consent?.marketing && !stale ? 'grant' : 'revoke')
    },
    page(page, context) {
      if (!isReady() || stale || !context.consent?.marketing) return
      window.fbq?.('track', 'PageView', {}, { eventID: page.id })
    },
    track(event, context) {
      if (!isReady() || stale || !context.consent?.marketing) return
      const { method, name, params } = toMetaEvent(event)
      window.fbq?.(method, name, params, { eventID: event.id })
    },
  })
}
