import { isDevMode } from '@angular/core'
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'
import { environment } from '../environments/environment'

export const analytics = createAnalytics({
  providers: [ga4({ measurementId: environment.ga4MeasurementId }), meta({ pixelId: environment.facebookPixelId })],
  autoTracking: true,
  enabled: !isDevMode() || environment.enableAnalytics,
  debug: environment.analyticsDebug,
})
