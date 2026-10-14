export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  modules: ['consentlayer/nuxt'],
  runtimeConfig: {
    public: {
      ga4MeasurementId: '',
      facebookPixelId: '',
      facebookPixelNoscript: false,
      enableAnalytics: false,
      analyticsDebug: false,
    },
  },
})
