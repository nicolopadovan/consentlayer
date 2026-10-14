import type { ServerDestination } from './handler'
import { sendMeasurementProtocol } from './measurement-protocol'

const collectUrl = (measurementId: string, apiSecret: string) =>
  `https://www.google-analytics.com/mp/collect?${new URLSearchParams({ measurement_id: measurementId, api_secret: apiSecret })}`

/**
 * GA4 Measurement Protocol, for server-only events (webhooks). It augments
 * gtag rather than replacing it, so `createAnalyticsHandler` doesn't take it.
 * Off (`undefined`) while `measurementId` or `apiSecret` is unset.
 */
export function ga4Server(options: {
  measurementId: string | undefined
  apiSecret: string | undefined
  fetchImpl?: typeof fetch
}): ServerDestination<false> | undefined {
  const measurementId = options.measurementId?.trim()
  const apiSecret = options.apiSecret?.trim()
  if (!measurementId || !apiSecret) {
    if (measurementId || apiSecret)
      console.warn('[consentlayer] ga4Server is off: set both measurementId and apiSecret.')
    return undefined
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  return {
    id: 'ga4',
    requiredConsent: 'analytics',
    forwardBrowserEvents: false,
    send: (event, request) =>
      sendMeasurementProtocol(
        { url: collectUrl(measurementId, apiSecret), sender: 'ga4Server', receiver: 'GA4 Measurement Protocol' },
        event,
        request,
        fetchImpl,
      ),
  }
}
