import {
  createElement,
  type ComponentPropsWithoutRef,
} from 'react'
import type {
  AnalyticsEventPayload,
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

const STANDARD_EVENTS = new Set([
  'AddPaymentInfo',
  'AddToCart',
  'AddToWishlist',
  'CompleteRegistration',
  'Contact',
  'CustomizeProduct',
  'Donate',
  'FindLocation',
  'InitiateCheckout',
  'Lead',
  'PageView',
  'Purchase',
  'Schedule',
  'Search',
  'StartTrial',
  'SubmitApplication',
  'Subscribe',
  'ViewContent',
])

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
    const hasIdentity = identity.email || identity.phone || identity.external_id
    await fetchImpl(serverEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        event_id: eventId,
        event_source_url:
          typeof window !== 'undefined' ? window.location.href : undefined,
        custom_data: customData,
        user: hasIdentity ? identity : undefined,
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
      const eventId = event.options.eventId ?? createEventId()
      const method = STANDARD_EVENTS.has(event.name) ? 'track' : 'trackCustom'
      window.fbq?.(method, event.name, event.params, { eventID: eventId })
      await mirrorEvent(event.name, eventId, event.params, context.identity)
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

export function metaEventIdFrom(event: AnalyticsEventPayload): string {
  return event.options.eventId ?? createEventId()
}
