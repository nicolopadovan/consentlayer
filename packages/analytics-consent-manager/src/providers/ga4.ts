import type { ProviderAdapter } from '../core/types'

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    gtag?: (...args: unknown[]) => void
    __acmGa4Configured?: Record<string, boolean>
  }
}

export type Ga4AdapterOptions = {
  measurementId: string
}

function ensureGtag(measurementId: string): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  window.gtag =
    window.gtag ??
    ((...args: unknown[]) => {
      window.dataLayer?.push({ args })
    })

  if (!document.querySelector(`script[data-ga4="${measurementId}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    script.dataset.ga4 = measurementId
    document.head.appendChild(script)
  }

  window.gtag('js', new Date())
  window.gtag('consent', 'default', {
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    ad_storage: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    security_storage: 'granted',
  })
}

export function createGa4Adapter(options: Ga4AdapterOptions): ProviderAdapter {
  return {
    id: 'ga4',
    requiredConsent: 'analytics',
    setup() {
      if (typeof window === 'undefined') return
      ensureGtag(options.measurementId)
    },
    init() {
      if (typeof window === 'undefined') return
      ensureGtag(options.measurementId)
      window.__acmGa4Configured = window.__acmGa4Configured ?? {}
      if (!window.__acmGa4Configured[options.measurementId]) {
        window.gtag?.('config', options.measurementId, {
          send_page_view: false,
        })
        window.__acmGa4Configured[options.measurementId] = true
      }
    },
    onConsentChange(context) {
      if (typeof window === 'undefined') return
      ensureGtag(options.measurementId)
      window.gtag?.('consent', 'update', {
        ad_user_data: context.consent?.marketing ? 'granted' : 'denied',
        ad_personalization: context.consent?.marketing ? 'granted' : 'denied',
        ad_storage: context.consent?.marketing ? 'granted' : 'denied',
        analytics_storage: context.consent?.analytics ? 'granted' : 'denied',
        functionality_storage: context.consent?.preferences ? 'granted' : 'denied',
        security_storage: 'granted',
      })
    },
    trackPage(payload) {
      if (typeof window === 'undefined') return
      window.gtag?.('event', 'page_view', {
        page_location: payload.url ?? window.location.href,
        page_path: payload.path ?? window.location.pathname,
        page_title: payload.title ?? document.title,
      })
    },
    trackEvent(event) {
      if (typeof window === 'undefined') return
      window.gtag?.('event', event.name, event.params)
    },
  }
}
