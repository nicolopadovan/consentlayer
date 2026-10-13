import type {
  ConsentIntegrationAdapter,
  ConsentState,
} from '../core/types'

declare global {
  interface Window {
    Shopify?: {
      customerPrivacy?: ShopifyCustomerPrivacy
      loadFeatures?: (
        features: Array<{ name: string; version: string }>,
        callback: (error?: unknown) => void,
      ) => void
    }
  }
}

type ShopifyCustomerPrivacy = {
  setTrackingConsent?: (
    args:
      | boolean
      | {
          marketing?: boolean
          analytics?: boolean
          preferences?: boolean
          sale_of_data?: boolean
          headlessStorefront?: boolean
          checkoutRootDomain?: string
          storefrontRootDomain?: string
          storefrontAccessToken?: string
        },
    callback?: () => void,
  ) => void
  currentVisitorConsent?: () => {
    marketing?: string
    analytics?: string
    preferences?: string
    sale_of_data?: string
  }
}

/** Options for `createShopifyCustomerPrivacyAdapter`. `headlessStorefront` is needed off Shopify-hosted themes. */
export type ShopifyCustomerPrivacyAdapterOptions = {
  canBootstrap?: () => boolean
  headlessStorefront?: {
    checkoutRootDomain?: string
    storefrontRootDomain?: string
    storefrontAccessToken?: string
  }
  loadFeature?: boolean
  document?: Document
  window?: Window
}

function coerceShopifyConsent(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (['granted', 'allow', 'accepted', 'yes', 'true'].includes(normalized)) {
      return true
    }
    if (['denied', 'reject', 'refused', 'no', 'false'].includes(normalized)) {
      return false
    }
  }
  return fallback
}

async function ensureCustomerPrivacyFeature(
  win: Window,
  loadFeature: boolean,
): Promise<void> {
  if (!loadFeature || !win.Shopify?.loadFeatures) return
  await new Promise<void>((resolve) => {
    win.Shopify?.loadFeatures?.(
      [{ name: 'consent-tracking-api', version: '0.1' }],
      () => resolve(),
    )
  })
}

/** Syncs consent with Shopify's Customer Privacy API, so Shopify and the store analytics agree. */
export function createShopifyCustomerPrivacyAdapter(
  options: ShopifyCustomerPrivacyAdapterOptions = {},
): ConsentIntegrationAdapter {
  const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined)
  const win = options.window ?? (typeof window !== 'undefined' ? window : undefined)

  return {
    id: 'shopify-customer-privacy',
    async bootstrap() {
      if (!win || !doc) return null
      if (options.canBootstrap && !options.canBootstrap()) return null
      await ensureCustomerPrivacyFeature(win, options.loadFeature ?? true)
      const explicit = win.Shopify?.customerPrivacy?.currentVisitorConsent?.()
      if (!explicit) return null
      const hasAnyExplicit = Object.values(explicit).some(
        (value) => typeof value === 'string' && value.length > 0,
      )
      if (!hasAnyExplicit) return null
      return {
        preferences: coerceShopifyConsent(explicit.preferences),
        analytics: coerceShopifyConsent(explicit.analytics),
        marketing: coerceShopifyConsent(explicit.marketing),
        ...(explicit.sale_of_data
          ? { sale_of_data: coerceShopifyConsent(explicit.sale_of_data) }
          : {}),
      }
    },
    async apply(consent) {
      if (!win) return
      await ensureCustomerPrivacyFeature(win, options.loadFeature ?? true)
      const args = {
        preferences: consent.preferences,
        analytics: consent.analytics,
        marketing: consent.marketing,
        ...(typeof consent.sale_of_data === 'boolean'
          ? { sale_of_data: consent.sale_of_data }
          : {}),
        ...(options.headlessStorefront
          ? {
              headlessStorefront: true,
              ...options.headlessStorefront,
            }
          : {}),
      }
      await new Promise<void>((resolve) => {
        win.Shopify?.customerPrivacy?.setTrackingConsent?.(args, () => resolve())
        resolve()
      })
    },
    subscribe(onConsent) {
      if (!doc) return () => undefined
      const handler = (event: Event) => {
        const detail = (event as CustomEvent).detail as
          | {
              marketingAllowed?: boolean
              analyticsAllowed?: boolean
              preferencesAllowed?: boolean
              saleOfDataAllowed?: boolean
            }
          | undefined
        const next: ConsentState = {
          marketing: Boolean(detail?.marketingAllowed),
          analytics: Boolean(detail?.analyticsAllowed),
          preferences: Boolean(detail?.preferencesAllowed),
          ...(typeof detail?.saleOfDataAllowed === 'boolean'
            ? { sale_of_data: detail.saleOfDataAllowed }
            : {}),
        }
        onConsent(next)
      }
      doc.addEventListener('visitorConsentCollected', handler)
      return () => doc.removeEventListener('visitorConsentCollected', handler)
    },
  }
}

/** URL of Shopify's Customer Privacy script, for headless storefronts that load it themselves. */
export function getShopifyCustomerPrivacyScriptUrl(): string {
  return 'https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.1/consent-tracking-api.js'
}
