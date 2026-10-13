import { ga4EventName } from '../providers/ga4'
import type { ServerDestination } from './handler'
import { isValidEmail, isValidPhoneE164 } from '../core/validation'
import { sha256 } from './http'

const collectUrl = (measurementId: string, apiSecret: string) =>
  `https://www.google-analytics.com/mp/collect?${new URLSearchParams({ measurement_id: measurementId, api_secret: apiSecret })}`

/** `GA1.1.123.456` → `123.456` */
function clientIdFromCookie(cookie: string | undefined): string | undefined {
  const parts = cookie?.split('.')
  return parts && parts.length >= 4 ? parts.slice(-2).join('.') : undefined
}

const consentValue = (granted: boolean) => (granted ? 'GRANTED' : 'DENIED')

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
  const { measurementId, apiSecret } = options
  if (!measurementId || !apiSecret) {
    if (measurementId || apiSecret) console.warn('[consentlayer] ga4Server is off: set both measurementId and apiSecret.')
    return undefined
  }
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
      const phone = event.identity?.phone && `+${event.identity.phone.replace(/\D/g, '')}`
      const userData = marketing
        ? Object.fromEntries(
            Object.entries({
              sha256_email_address: email && isValidEmail(email) ? await sha256(email) : undefined,
              sha256_phone_number: phone && isValidPhoneE164(phone) ? await sha256(phone) : undefined,
            }).filter(([, value]) => value),
          )
        : {}
      const response = await fetchImpl(collectUrl(measurementId, apiSecret), {
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
