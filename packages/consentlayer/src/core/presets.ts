export type EnvConfigInput = Record<string, string | undefined>

/**
 * Reads the documented `NEXT_PUBLIC_*` and server env vars into one typed object.
 * @deprecated Removed in 2.0. Pass `process.env` values to the providers directly; an unset one turns its provider off.
 */
export function createEnvConfig(env: EnvConfigInput) {
  const toNumber = (value: string | undefined) => {
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return {
    runtimeEnabled: env.NODE_ENV === 'production' || env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
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
