import { createAnalytics, type DebugOptions } from 'consentlayer'
import { autoTracking } from 'consentlayer/auto-tracking'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'

const debug = import.meta.env.VITE_ANALYTICS_DEBUG

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID }),
    meta({ pixelId: import.meta.env.VITE_FACEBOOK_PIXEL_ID }),
  ],
  autoTracking: autoTracking(),
  enabled: import.meta.env.PROD || import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  debug: debug ? (JSON.parse(debug) as boolean | DebugOptions) : false,
})
