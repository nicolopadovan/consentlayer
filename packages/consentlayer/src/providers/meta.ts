import type { EventName } from '../core/types'
import { META_EVENTS, metaUserData, toMetaEvent } from '../core/meta-events'
import { getNames } from '../core/names'
import { definePlugin, getFlag, loadScript, runInlineScript, setFlag, skippedPlugin } from '../core/plugin'
import { expireCookies } from '../core/utils'
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

/** Options for `meta`. */
export type MetaOptions = {
  /** `undefined` or `''` turns the provider off. */
  pixelId: string | undefined
  locale?: string
  /**
   * `true`: the pixel script loads at boot and is told consent is revoked.
   * `false` (default): nothing loads until marketing consent is granted.
   */
  loadBeforeConsent?: boolean
  /** Event names sent to the pixel; defaults to the events with a Meta standard event. */
  events?: readonly EventName[] | false
  /**
   * Keeps the landing page's `fbclid` until marketing consent, then sets the `_fbc` cookie from it if the pixel has not.
   * `'memory'` (default) lasts for the page load; `'session'` also keeps it in sessionStorage, before consent, so it
   * survives full page loads in the tab. `false` turns it off.
   */
  clickId?: 'memory' | 'session' | false
}

type ClickId = { fbclid: string; at: number }

const FBC_MAX_AGE = 90 * 86_400

const toClickId = (fbclid: unknown, at: unknown): ClickId | undefined =>
  typeof fbclid === 'string' && /^[\w-]+$/.test(fbclid) && typeof at === 'number' ? { fbclid, at } : undefined

function readSaved(key: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Partial<ClickId> | null
    return toClickId(saved?.fbclid, saved?.at)
  } catch {
    return undefined
  }
}

function clickIdStore(mode: 'memory' | 'session') {
  const landed = toClickId(new URLSearchParams(window.location.search).get('fbclid'), Date.now())
  let current: ClickId | undefined
  const session = (run: (key: string) => void) => {
    if (mode !== 'session') return
    try {
      run(`${getNames().prefix}_fbclid`)
    } catch {
      // sessionStorage can be unavailable; the click ID then lasts for the page load
    }
  }
  return {
    restore() {
      current = landed
      if (current) session((key) => sessionStorage.setItem(key, JSON.stringify(current)))
      else
        session((key) => {
          current = readSaved(key)
        })
    },
    take() {
      const taken = current
      current = undefined
      session((key) => sessionStorage.removeItem(key))
      return taken
    },
  }
}

function setFbc({ fbclid, at }: ClickId) {
  const labels = window.location.hostname.split('.')
  const attributes = `; max-age=${FBC_MAX_AGE}; path=/; SameSite=Lax`
  for (let start = labels.length - 2; start >= 0; start--) {
    const domain = labels.slice(start).join('.')
    document.cookie = `_fbc=fb.${labels.length - start - 1}.${at}.${fbclid}${attributes}; domain=${domain}`
    if (hasCookie('_fbc')) return
  }
  document.cookie = `_fbc=fb.0.${at}.${fbclid}${attributes}`
}

const hasCookie = (name: string) => document.cookie.split(';').some((cookie) => cookie.trim().startsWith(`${name}=`))

/** Meta Pixel, after marketing consent. Pass `server` to `createAnalytics` to also send events to the Conversions API. */
const isOwnCookie = (name: string) => name === '_fbp' || name === '_fbc'

export function meta(options: MetaOptions) {
  if (!options.pixelId?.trim()) return skippedPlugin('meta', 'pixelId')
  const pixelId = assertValidMetaPixelId(options.pixelId.trim())
  const locale = options.locale ?? 'en_US'
  const clickMode = options.clickId ?? 'memory'
  const clickIds = clickMode && typeof window !== 'undefined' ? clickIdStore(clickMode) : undefined

  const isReady = () =>
    typeof window !== 'undefined' && typeof window.fbq === 'function' && getFlag('MetaPixelInitialized') === true

  // The pixel keeps init's email/phone, so after a withdrawal it stays off until reload.
  let matched = false
  let stale = false

  return definePlugin({
    id: 'meta',
    events: options.events ?? META_EVENTS,
    requiredConsent: 'marketing',
    loadBeforeConsent: options.loadBeforeConsent ?? false,
    load(loadContext) {
      if (typeof window === 'undefined' || getFlag('MetaPixelInitialized')) return

      runInlineScript(
        `!function(f,b,e,v,n){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window);
fbq('consent', ${loadContext.consent?.marketing ? "'grant'" : "'revoke'"});
fbq('init', ${JSON.stringify(pixelId)}, ${JSON.stringify(metaUserData(loadContext.identity)).replace(/</g, '\\u003c')});`,
        'meta-pixel-bootstrap',
      )
      matched = Boolean(loadContext.identity.email || loadContext.identity.phone)
      loadScript(`https://connect.facebook.net/${encodeURIComponent(locale)}/fbevents.js`).catch(() =>
        loadContext.emitError({
          scope: 'provider-script-load',
          message: 'Failed to load Meta Pixel (fbevents.js)',
        }),
      )

      setFlag('MetaPixelInitialized', true)
    },
    setup() {
      clickIds?.restore()
    },
    consent(context) {
      if (typeof window !== 'undefined' && context.consent && !context.consent.marketing) expireCookies(isOwnCookie)
      if (context.consent?.marketing) {
        const clickId = clickIds?.take()
        if (clickId && !hasCookie('_fbc')) setFbc(clickId)
      }
      if (!isReady()) return
      if (matched && !context.consent?.marketing) stale = true
      window.fbq?.('consent', context.consent?.marketing && !stale ? 'grant' : 'revoke')
    },
    teardown(context) {
      if (typeof window === 'undefined' || context.consent?.marketing) return
      expireCookies(isOwnCookie)
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
