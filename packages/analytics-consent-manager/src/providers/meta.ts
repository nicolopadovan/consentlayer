import {
  createElement,
  type ComponentPropsWithoutRef,
} from 'react'
import type {
  AnalyticsEventPayload,
  EcommerceItem,
  ProviderAdapter,
  UserIdentity,
} from '../core/types'
import { getFlag, setFlag } from '../core/names'
import { consentLatch, createEventId } from '../core/utils'
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

export type MetaAdapterOptions = {
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

export function createMetaAdapter(
  options: MetaAdapterOptions,
): ProviderAdapter {
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

  return {
    id: 'meta',
    requiredConsent: 'marketing',
    enabled:
      options.loadBeforeConsent === false ? consentLatch('marketing') : undefined,
    setup(setupContext) {
      if (typeof window === 'undefined' || getFlag('MetaPixelInitialized')) return

      const bootstrap = document.createElement('script')
      bootstrap.setAttribute(
        'data-analytics-consent-manager',
        'meta-pixel-bootstrap',
      )
      bootstrap.text = `!function(f,b,e,v,n){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window);
fbq('consent', ${setupContext.consent?.marketing ? "'grant'" : "'revoke'"});
fbq('init', ${JSON.stringify(pixelId)});`
      document.head.appendChild(bootstrap)

      const loader = document.createElement('script')
      loader.setAttribute(
        'data-analytics-consent-manager',
        'meta-pixel-loader',
      )
      loader.async = true
      loader.src = `https://connect.facebook.net/${encodeURIComponent(locale)}/fbevents.js`
      loader.onerror = () => {
        setupContext.emitError({
          scope: 'provider-script-load',
          providerId: 'meta',
          message: 'Failed to load Meta Pixel (fbevents.js)',
        })
      }
      document.head.appendChild(loader)

      setFlag('MetaPixelInitialized', true)
    },
    onConsentChange(context) {
      if (!isReady()) return
      window.fbq?.('consent', context.consent?.marketing ? 'grant' : 'revoke')
    },
    async trackPage(_, context) {
      if (!isReady() || !context.consent?.marketing) return
      const eventId = createEventId()
      window.fbq?.('track', 'PageView', {}, { eventID: eventId })
      await mirrorEvent('PageView', eventId, undefined, context.identity)
    },
    async trackEvent(event, context) {
      if (!isReady() || !context.consent?.marketing) return
      const { method, name, params } = toMetaEvent(event)
      window.fbq?.(method, name, params, { eventID: event.id })
      await mirrorEvent(name, event.id, params, context.identity)
    },
  }
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
