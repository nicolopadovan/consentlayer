import type { AnalyticsOptions } from '../core/create-analytics'

/** The default export of `app/consentlayer.config.ts`: returns the `createAnalytics()` options. Runs inside the Nuxt app, so `useRuntimeConfig()` works. */
export const defineConsentLayerConfig = (factory: () => AnalyticsOptions) => factory
