import { ga4EventName } from '../providers/ga4'
import type { ServerDestination } from './handler'
import { sha256 } from './meta'

export type Ga4MeasurementEventInput = {
  clientId?: string
  userId?: string
  eventName?: string
  params?: Record<string, unknown>
}

export function createGa4MeasurementPayload(
  input: Ga4MeasurementEventInput,
) {
  return {
    client_id: input.clientId ?? '555.555',
    user_id: input.userId,
    events: [
      {
        name: input.eventName ?? 'page_view',
        params: input.params ?? {},
      },
    ],
  }
}

export function createGa4CollectUrl(input: {
  measurementId: string
  apiSecret: string
}): string {
  const url = new URL('https://www.google-analytics.com/mp/collect')
  url.searchParams.set('measurement_id', input.measurementId)
  url.searchParams.set('api_secret', input.apiSecret)
  return url.toString()
}

export async function sendGa4MeasurementEvent(input: {
  measurementId: string
  apiSecret: string
  payload: ReturnType<typeof createGa4MeasurementPayload>
  fetchImpl?: typeof fetch
}) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  if (!fetchImpl) {
    throw new Error('fetch is required to send GA4 measurement events')
  }
  return fetchImpl(
    createGa4CollectUrl({
      measurementId: input.measurementId,
      apiSecret: input.apiSecret,
    }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    },
  )
}

/** `GA1.1.123.456` → `123.456` */
function clientIdFromCookie(cookie: string | undefined): string | undefined {
  const parts = cookie?.split('.')
  return parts && parts.length >= 4 ? parts.slice(-2).join('.') : undefined
}

const consentValue = (granted: boolean) => (granted ? 'GRANTED' : 'DENIED')

/**
 * GA4 Measurement Protocol, for server-only events (webhooks). It augments
 * gtag rather than replacing it, so `createAnalyticsHandler` doesn't take it.
 */
export function ga4Server(options: {
  measurementId: string
  apiSecret: string
  fetchImpl?: typeof fetch
}): ServerDestination<false> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  return {
    id: 'ga4',
    requiredConsent: 'analytics',
    forwardBrowserEvents: false,
    async send(event, request) {
      const clientId = event.clientId ?? clientIdFromCookie(request?.cookies._ga)
      if (!clientId) throw new Error('ga4Server needs event.clientId or the _ga cookie')
      const marketing = event.consent.marketing
      const email = event.identity?.email?.trim().toLowerCase()
      const phone = event.identity?.phone?.replace(/[^\d+]/g, '')
      const userData = marketing
        ? Object.fromEntries(
            Object.entries({
              sha256_email_address: sha256(email),
              sha256_phone_number: sha256(phone && (phone.startsWith('+') ? phone : `+${phone}`)),
            }).filter(([, value]) => value),
          )
        : {}
      const response = await fetchImpl(createGa4CollectUrl(options), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          user_id: event.identity?.userId,
          user_data: Object.keys(userData).length ? userData : undefined,
          consent: { ad_user_data: consentValue(marketing), ad_personalization: consentValue(marketing) },
          events: [
            {
              name: ga4EventName(event.name),
              params: { ...event.params, ...event.providers?.ga4 },
            },
          ],
        }),
      })
      if (!response.ok) throw new Error(`GA4 Measurement Protocol ${response.status}: ${await response.text()}`)
    },
  }
}
