import { isValidEmail, isValidPhoneE164 } from '../core/validation'
import { ga4EventName } from '../providers/ga4'
import type { ServerEvent, ServerRequestInfo } from './handler'
import { sha256 } from './http'

/** `GA1.1.123.456` → `123.456` */
function clientIdFromCookie(cookie: string | undefined): string | undefined {
  const parts = cookie?.split('.')
  return parts && parts.length >= 4 ? parts.slice(-2).join('.') : undefined
}

const consentValue = (granted: boolean) => (granted ? 'GRANTED' : 'DENIED')

/** Posts `event` as a GA4 Measurement Protocol request; `sender` and `receiver` name both ends in errors. */
export async function sendMeasurementProtocol(
  { url, sender, receiver }: { url: string; sender: string; receiver: string },
  event: ServerEvent,
  request: ServerRequestInfo | undefined,
  fetchImpl: typeof fetch,
) {
  const clientId = event.clientId ?? clientIdFromCookie(request?.cookies._ga)
  if (!clientId) throw new Error(`${sender} needs event.clientId or the _ga cookie`)
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
  const response = await fetchImpl(url, {
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
          params: { ...(event.url && { page_location: event.url }), ...event.params, ...event.providers?.ga4 },
        },
      ],
    }),
  })
  if (!response.ok) throw new Error(`${receiver} ${response.status}: ${await response.text()}`)
}
