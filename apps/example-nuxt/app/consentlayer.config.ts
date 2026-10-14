import { autoTracking } from 'consentlayer/auto-tracking'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'

export default defineConsentLayerConfig(() => {
  const config = useRuntimeConfig().public
  return {
    providers: [ga4({ measurementId: config.ga4MeasurementId }), meta({ pixelId: String(config.facebookPixelId) })],
    autoTracking: autoTracking(),
    enabled: import.meta.env.PROD || config.enableAnalytics,
    debug: config.analyticsDebug,
  }
})
