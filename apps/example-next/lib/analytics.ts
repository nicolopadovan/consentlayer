import { createAnalytics } from 'consentlayer'
import { autoTracking } from 'consentlayer/auto-tracking'
import { ga4 } from 'consentlayer/providers/ga4'
import { hotjar } from 'consentlayer/providers/hotjar'
import { meta } from 'consentlayer/providers/meta'
import { posthog } from 'consentlayer/providers/posthog'
import { sentry } from 'consentlayer/providers/sentry'
import { shopifyCustomerPrivacy } from 'consentlayer/adapters/shopify'

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID }),
    meta({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID }),
    posthog({ apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY, defer: 'idle' }),
    sentry({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN }),
    hotjar({ siteId: process.env.NEXT_PUBLIC_HOTJAR_SITE_ID, version: process.env.NEXT_PUBLIC_HOTJAR_VERSION }),
  ],
  consent: {
    adapters: [
      shopifyCustomerPrivacy({
        loadFeature: true,
        headlessStorefront: { storefrontAccessToken: process.env.NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN },
      }),
    ],
  },
  server: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ? { endpoint: '/api/analytics' } : undefined,
  autoTracking: autoTracking(),
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  debug: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true',
})

declare module 'consentlayer' {
  interface Register {
    events: { quote_requested: { value: number; currency: string } }
  }
}
