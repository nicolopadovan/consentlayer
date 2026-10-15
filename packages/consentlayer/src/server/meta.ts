import { META_EVENTS, toMetaEvent } from '../core/meta-events'
import { isValidEmail, isValidPhoneE164 } from '../core/validation'
import type { ServerDestination } from './handler'
import { sha256 } from './http'

const isPlainValue = (value: unknown) =>
  value === null ||
  ['string', 'number', 'boolean'].includes(typeof value) ||
  Array.isArray(value) ||
  (typeof value === 'object' && value.constructor === Object)

/** Meta Conversions API. Receives browser events too; Meta dedupes them by event ID. Off (`undefined`) while `pixelId` or `accessToken` is unset. */
export function metaCapi(options: {
  pixelId: string | undefined
  accessToken: string | undefined
  testEventCode?: string
  /** Graph API version. */
  apiVersion?: string
  /** Event names sent; defaults to the events with a Meta standard event. */
  events?: readonly string[] | false
  fetchImpl?: typeof fetch
}): ServerDestination<true> | undefined {
  const pixelId = options.pixelId?.trim()
  const accessToken = options.accessToken?.trim()
  if (!pixelId || !accessToken) {
    if (pixelId || accessToken) console.warn('[consentlayer] metaCapi is off: set both pixelId and accessToken.')
    return undefined
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  return {
    id: 'meta',
    events: options.events ?? META_EVENTS,
    requiredConsent: 'marketing',
    forwardBrowserEvents: true,
    async send(event, request) {
      const { name, params } = toMetaEvent({
        id: event.id ?? '',
        name: event.name,
        params: event.params ?? {},
        options: { providers: event.providers },
      })
      const email = event.identity?.email?.trim().toLowerCase()
      const phone = event.identity?.phone && `+${event.identity.phone.replace(/\D/g, '')}`
      const url = new URL(`https://graph.facebook.com/${options.apiVersion ?? 'v26.0'}/${pixelId}/events`)
      url.searchParams.set('access_token', accessToken)
      if (options.testEventCode) url.searchParams.set('test_event_code', options.testEventCode)
      const response = await fetchImpl(url.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            {
              event_name: name,
              event_time: Math.floor(Date.now() / 1000),
              event_id: event.id,
              event_source_url: event.url,
              action_source: 'website',
              custom_data: Object.fromEntries(Object.entries(params).filter(([, value]) => isPlainValue(value))),
              user_data: {
                client_ip_address: request?.ip,
                client_user_agent: request?.userAgent,
                fbp: request?.cookies._fbp,
                fbc: request?.cookies._fbc,
                em: email && isValidEmail(email) ? await sha256(email) : undefined,
                ph: phone && isValidPhoneE164(phone) ? await sha256(phone.slice(1)) : undefined,
                external_id: await sha256(event.identity?.userId),
              },
            },
          ],
        }),
      })
      if (!response.ok) throw new Error(`Meta CAPI ${response.status}: ${await response.text()}`)
    },
  }
}
