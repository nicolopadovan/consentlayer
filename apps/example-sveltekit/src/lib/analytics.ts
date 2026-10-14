import { dev } from '$app/env'
import { ANALYTICS_DEBUG, ENABLE_ANALYTICS, FACEBOOK_PIXEL_ID, GA4_MEASUREMENT_ID } from '$app/env/public'
import { createAnalytics } from 'consentlayer'
import { autoTracking } from 'consentlayer/auto-tracking'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'

export const analytics = createAnalytics({
  providers: [ga4({ measurementId: GA4_MEASUREMENT_ID }), meta({ pixelId: FACEBOOK_PIXEL_ID })],
  autoTracking: autoTracking(),
  enabled: !dev || ENABLE_ANALYTICS,
  debug: ANALYTICS_DEBUG,
})
