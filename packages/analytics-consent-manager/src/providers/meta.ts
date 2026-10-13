import {
  createElement,
  type ComponentPropsWithoutRef,
} from 'react'
import type {
  AnalyticsEventPayload,
  EcommerceItem,
  UserIdentity,
} from '../core/types'
import { definePlugin, getFlag, loadScript, setFlag } from '../core/plugin'
import {
  assertHttpsOrRelativeUrl,
  assertValidMetaPixelId,
} from '../core/validation'

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
  serverEndpoint?: string
  fetchImpl?: typeof fetch
  locale?: string
  /**
   * `true` (default): the pixel script loads at boot and is told consent is revoked.
   * `false`: nothing loads until marketing consent is granted.
   */
  loadBeforeConsent?: boolean
}

const META_EVENT_NAMES: Record<string, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  add_to_wishlist: 'AddToWishlist',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  sign_up: 'CompleteRegistration',
  lead: 'Lead',
  search: 'Search',
  contact: 'Contact',
  trial_started: 'StartTrial',
  subscription_started: 'Subscribe',
  customize_product: 'CustomizeProduct',
  schedule: 'Schedule',
  submit_application: 'SubmitApplication',
  find_location: 'FindLocation',
  donate: 'Donate',
}
const META_STANDARD = new Set([...Object.values(META_EVENT_NAMES), 'PageView'])

/** Translates a standard event into a Meta standard event, or a custom one. */
export function toMetaEvent(event: AnalyticsEventPayload): {
  method: 'track' | 'trackCustom'
  name: string
  params: Record<string, unknown>
} {
  const standard =
    META_EVENT_NAMES[event.name] ?? (META_STANDARD.has(event.name) ? event.name : undefined)
  const { items, search_term, ...rest } = event.params as {
    items?: EcommerceItem[]
    search_term?: string
  } & Record<string, unknown>
  const params: Record<string, unknown> = { ...rest }
  if (Array.isArray(items) && items.length) {
    const id = (item: EcommerceItem) => item.item_variant ?? item.item_id
    params.content_ids = items.map(id)
    params.contents = items.map((item) => ({
      id: id(item),
      quantity: item.quantity ?? 1,
      item_price: item.price,
    }))
    params.content_type = 'product'
    params.num_items = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
  }
  if (search_term !== undefined) params.search_string = search_term
  return {
    method: standard ? 'track' : 'trackCustom',
    name: standard ?? event.name,
    params: { ...params, ...event.options.providers?.meta },
  }
}

/** Advanced matching; Meta accepts it only in `fbq('init')`. */
export function metaUserData(identity: UserIdentity): Record<string, string> {
  const data: Record<string, string> = {}
  if (identity.email) data.em = identity.email
  if (identity.phone) data.ph = identity.phone.replace(/\D/g, '')
  if (identity.userId) data.external_id = identity.userId
  return data
}

export function meta(options: MetaOptions) {
  const pixelId = assertValidMetaPixelId(options.pixelId)
  const serverEndpoint =
    options.serverEndpoint !== undefined
      ? assertHttpsOrRelativeUrl(options.serverEndpoint, 'Meta serverEndpoint')
      : undefined
  const locale = options.locale ?? 'en_US'

  const isReady = () =>
    typeof window !== 'undefined' &&
    typeof window.fbq === 'function' &&
    getFlag('MetaPixelInitialized') === true

  const mirrorEvent = async (
    eventName: string,
    eventId: string,
    customData: Record<string, unknown> | undefined,
    identity: UserIdentity,
  ) => {
    if (!serverEndpoint) return
    const fetchImpl = options.fetchImpl ?? globalThis.fetch
    if (!fetchImpl) return
    const user = {
      email: identity.email,
      phone: identity.phone,
      external_id: identity.userId,
    }
    const hasIdentity = user.email || user.phone || user.external_id
    await fetchImpl(serverEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_source_url:
          typeof window !== 'undefined' ? window.location.href : undefined,
        custom_data: customData,
        user: hasIdentity ? user : undefined,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }

  // The pixel keeps init's email/phone, so after a withdrawal it stays off until reload.
  let matched = false
  let stale = false

  return definePlugin({
    id: 'meta',
    requiredConsent: 'marketing',
    loadBeforeConsent: options.loadBeforeConsent ?? true,
    load(loadContext) {
      if (typeof window === 'undefined' || getFlag('MetaPixelInitialized')) return

      const bootstrap = document.createElement('script')
      bootstrap.setAttribute(
        'data-analytics-consent-manager',
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
    async page(page, context) {
      if (!isReady() || !context.consent?.marketing) return
      if (!stale) window.fbq?.('track', 'PageView', {}, { eventID: page.id })
      await mirrorEvent('PageView', page.id, undefined, context.identity)
    },
    async track(event, context) {
      if (!isReady() || !context.consent?.marketing) return
      const { method, name, params } = toMetaEvent(event)
      if (!stale) window.fbq?.(method, name, params, { eventID: event.id })
      await mirrorEvent(name, event.id, params, context.identity)
    },
  })
}

export function renderMetaPixelNoscriptHtml(pixelId: string): string {
  return `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`
}

export function MetaPixelNoscript(
  props: {
    pixelId: string
    enabled?: boolean
  } & ComponentPropsWithoutRef<'img'>,
) {
  const { pixelId, enabled, ...imageProps } = props
  if (!enabled) return null
  return createElement(
    'noscript',
    undefined,
    createElement('img', {
      ...imageProps,
      alt: '',
      height: imageProps.height ?? 1,
      width: imageProps.width ?? 1,
      style: { display: 'none', ...imageProps.style },
      src: renderMetaPixelNoscriptHtml(pixelId),
    }),
  )
}
