import { sendsToTikTok, tiktokUserData, toTikTokEvent } from '../core/tiktok-events'
import { isValidEmail, isValidPhoneE164 } from '../core/validation'
import type { ServerDestination } from './handler'
import { sha256 } from './http'

/**
 * TikTok Events API. Receives browser events too; TikTok dedupes them by event ID.
 * Page views stay with the pixel. Off (`undefined`) while `pixelId` or `accessToken` is unset.
 */
export function tiktokEvents(options: {
  pixelId: string | undefined
  accessToken: string | undefined
  testEventCode?: string
  /** Event names sent. Defaults to the events that have a TikTok standard event; custom events are sent only when listed. */
  events?: readonly string[]
  fetchImpl?: typeof fetch
}): ServerDestination<true> | undefined {
  const pixelId = options.pixelId?.trim()
  const accessToken = options.accessToken?.trim()
  if (!pixelId || !accessToken) {
    if (pixelId || accessToken) console.warn('[consentlayer] tiktokEvents is off: set both pixelId and accessToken.')
    return undefined
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  return {
    id: 'tiktok',
    requiredConsent: 'marketing',
    forwardBrowserEvents: true,
    async send(event, request) {
      // ttq.page() takes no event ID, so a server copy of a page view could not be deduplicated.
      if (event.name === 'page_view' || !sendsToTikTok(event.name, options.events, event.only)) return
      const { name, params } = toTikTokEvent({
        id: event.id ?? '',
        name: event.name,
        params: event.params ?? {},
        options: { providers: event.providers },
      })
      const { email, phone_number: phone, external_id } = tiktokUserData(event.identity ?? {})
      const response = await fetchImpl('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
        method: 'POST',
        headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_source: 'web',
          event_source_id: pixelId,
          test_event_code: options.testEventCode,
          data: [
            {
              event: name,
              event_time: Math.floor(Date.now() / 1000),
              event_id: event.id,
              user: {
                email: email && isValidEmail(email) ? await sha256(email) : undefined,
                phone: phone && isValidPhoneE164(phone) ? await sha256(phone) : undefined,
                external_id: await sha256(external_id),
                ip: request?.ip,
                user_agent: request?.userAgent,
                ttp: request?.cookies._ttp,
                ttclid: request?.cookies.ttclid,
              },
              properties: params,
              page: { url: event.url },
            },
          ],
        }),
      })
      const result = (await response.json().catch(() => ({}))) as { code?: number; message?: string }
      if (!response.ok || result.code !== 0) {
        throw new Error(`TikTok Events API ${response.ok ? result.code : response.status}: ${result.message}`)
      }
    },
  }
}
