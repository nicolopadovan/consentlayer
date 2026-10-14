import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'
import { consentLayer } from 'consentlayer/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public
  const analytics = createAnalytics({
    providers: [
      ga4({ measurementId: config.ga4MeasurementId }),
      meta({ pixelId: config.facebookPixelId }),
    ],
    autoTracking: true,
    enabled: import.meta.env.PROD || config.enableAnalytics,
    debug: config.analyticsDebug,
  })
  nuxtApp.vueApp.use(consentLayer, { analytics, router: nuxtApp.$router })
})
