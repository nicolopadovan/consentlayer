export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      ga4MeasurementId: '',
      facebookPixelId: '',
      enableAnalytics: false,
      analyticsDebug: false,
    },
  },
})
