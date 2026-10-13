import { createAnalytics, createEnvConfig, type AnalyticsPlugin } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { hotjar } from 'consentlayer/providers/hotjar'
import { meta } from 'consentlayer/providers/meta'
import { posthog } from 'consentlayer/providers/posthog'
import { sentry } from 'consentlayer/providers/sentry'
import { createShopifyCustomerPrivacyAdapter } from 'consentlayer/providers/shopify'

// Next inlines only literal `process.env.NEXT_PUBLIC_*` reads into browser code.
const env = createEnvConfig({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  NEXT_PUBLIC_ANALYTICS_DEBUG: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG,
  NEXT_PUBLIC_FACEBOOK_PIXEL_ID: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  NEXT_PUBLIC_HOTJAR_SITE_ID: process.env.NEXT_PUBLIC_HOTJAR_SITE_ID,
  NEXT_PUBLIC_HOTJAR_VERSION: process.env.NEXT_PUBLIC_HOTJAR_VERSION,
  NEXT_PUBLIC_SHOPIFY_STORE_ID: process.env.NEXT_PUBLIC_SHOPIFY_STORE_ID,
  NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN,
})
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

const providers: AnalyticsPlugin[] = []
if (env.ga4.measurementId) providers.push(ga4({ measurementId: env.ga4.measurementId }))
if (env.meta.pixelId) providers.push(meta({ pixelId: env.meta.pixelId }))
if (env.hotjar.siteId && env.hotjar.version) {
  providers.push(hotjar({ siteId: env.hotjar.siteId, version: env.hotjar.version }))
}
if (posthogKey) providers.push(posthog({ apiKey: posthogKey, defer: 'idle' }))
if (sentryDsn) providers.push(sentry({ dsn: sentryDsn }))

export const analytics = createAnalytics({
  providers,
  consent: {
    adapters: [
      createShopifyCustomerPrivacyAdapter({
        loadFeature: true,
        ...(env.shopify.storefrontAccessToken
          ? { headlessStorefront: { storefrontAccessToken: env.shopify.storefrontAccessToken } }
          : {}),
      }),
    ],
  },
  server: env.meta.pixelId ? { endpoint: '/api/analytics' } : undefined,
  autoTracking: true,
  enabled: env.runtimeEnabled,
  debug: env.debug,
})
