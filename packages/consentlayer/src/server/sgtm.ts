import { isHttpsOrRelativeUrl } from '../core/validation'
import type { ServerDestination } from './handler'
import { sendMeasurementProtocol } from './measurement-protocol'

/**
 * Server-side Google Tag Manager: events go, as GA4 Measurement Protocol
 * requests, to the Measurement Protocol client of your server container.
 * Receives browser events too. Off (`undefined`) while `url` or `measurementId` is unset.
 */
export function sgtm(options: {
  /** The client's endpoint: your tagging server and the client's activation path, e.g. `https://sgtm.example.com/mp/collect`. */
  url: string | undefined
  measurementId: string | undefined
  /** Sent as `api_secret`, for a client or tag that checks it. */
  apiSecret?: string
  fetchImpl?: typeof fetch
}): ServerDestination<true> | undefined {
  const url = options.url?.trim()
  const measurementId = options.measurementId?.trim()
  if (!url || !measurementId) {
    if (url || measurementId) console.warn('[consentlayer] sgtm is off: set both url and measurementId.')
    return undefined
  }
  if (url.startsWith('/') || !isHttpsOrRelativeUrl(url)) {
    throw new Error(`[consentlayer] sgtm url must be an HTTPS URL, received "${url}".`)
  }
  const endpoint = new URL(url)
  endpoint.searchParams.set('measurement_id', measurementId)
  if (options.apiSecret?.trim()) endpoint.searchParams.set('api_secret', options.apiSecret.trim())
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  return {
    id: 'sgtm',
    requiredConsent: 'analytics',
    forwardBrowserEvents: true,
    send: (event, request) =>
      sendMeasurementProtocol({ url: endpoint.href, sender: 'sgtm', receiver: 'Server-side GTM' }, event, request, fetchImpl),
  }
}
