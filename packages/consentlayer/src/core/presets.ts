import { getNames } from './names'

/** Live view of the names set with `configureNames()`. */
export const defaultRuntimePreset = {
  get consentStorageKey() {
    return getNames().consentStorageKey
  },
  get identityStorageKey() {
    return getNames().identityStorageKey
  },
  get consentEventName() {
    return getNames().consentEventName
  },
  get consentGlobalKey() {
    return getNames().consentGlobalKey
  },
  get openConsentGlobalKey() {
    return getNames().openConsentGlobalKey
  },
  get autoTrackingEvents() {
    return getNames().autoTrackingEvents
  },
}

export type EnvConfigInput = Record<string, string | undefined>

export function createEnvConfig(env: EnvConfigInput) {
  const toNumber = (value: string | undefined) => {
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return {
    runtimeEnabled:
      env.NODE_ENV === 'production' ||
      env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    debug: env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true',
    ga4: {
      measurementId: env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
    },
    hotjar: {
      siteId: toNumber(env.NEXT_PUBLIC_HOTJAR_SITE_ID),
      version: toNumber(env.NEXT_PUBLIC_HOTJAR_VERSION),
    },
    meta: {
      pixelId: env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID,
      noscriptEnabled: env.NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT === 'true',
    },
    shopify: {
      storeId: env.NEXT_PUBLIC_SHOPIFY_STORE_ID,
      storefrontDomain: env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN,
      storefrontAccessToken: env.NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN,
    },
    server: {
      metaToken: env.META_TOKEN,
      facebookTestEventCode: env.FACEBOOK_TEST_EVENT_CODE,
      ga4ApiSecret: env.GA4_API_SECRET,
    },
  }
}
