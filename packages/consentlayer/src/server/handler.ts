import type { ConsentState, ServerEvent } from '../core/types'
import { receivesEvent } from '../core/utils'
import { assertSecret, readConsentCookie, type ConsentCookieOptions } from './consent'
import { ANALYTICS_MAX_BODY, assertSameOrigin, parseCookieHeader, parseJsonWithLimit } from './http'

export type { ServerEvent }

/** Request details destinations use: client IP, user agent and cookies. */
export type ServerRequestInfo = {
  ip?: string
  userAgent?: string
  cookies: Record<string, string>
}

/** A server-side destination. `send` throws when the vendor rejects the event. */
export interface ServerDestination<Forward extends boolean = boolean> {
  id: string
  requiredConsent: keyof ConsentState
  /** Whether `createAnalyticsHandler` may send browser events to it. */
  forwardBrowserEvents: Forward
  /** Event names sent to it, `page_view` included: all when unset, none with `false`. An event whose `only` names it is always sent. */
  events?: readonly string[] | false
  send(event: ServerEvent, request?: ServerRequestInfo): Promise<void>
}

/** Whether one destination accepted the event. */
export type ServerSendResult = { id: string; ok: boolean; error?: unknown }

/** Sends to every destination the event's consent and `only` allow, in parallel. `undefined` entries are destinations that are off. */
export async function sendServerEvent(
  event: ServerEvent,
  options: { destinations: (ServerDestination | undefined)[]; request?: ServerRequestInfo },
): Promise<ServerSendResult[]> {
  const targets = options.destinations.filter(
    (destination): destination is ServerDestination =>
      destination !== undefined &&
      event.consent[destination.requiredConsent] === true &&
      (!event.only || event.only.includes(destination.id)) &&
      receivesEvent(destination, event.name, event.only) &&
      (!event.categories || event.categories.includes(destination.requiredConsent)),
  )
  const results = await Promise.allSettled(targets.map((destination) => destination.send(event, options.request)))
  return targets.map((destination, index) => {
    const result = results[index]
    return result?.status === 'rejected'
      ? { id: destination.id, ok: false, error: result.reason as unknown }
      : { id: destination.id, ok: true }
  })
}

/** IP, user agent and cookies of a request, for `sendServerEvent({ request })`. */
export function requestInfo(request: Request): ServerRequestInfo {
  const headers = request.headers
  return {
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || undefined,
    userAgent: headers.get('user-agent') ?? undefined,
    cookies: parseCookieHeader(headers.get('cookie') ?? ''),
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value)
const isString = (value: unknown) => typeof value === 'string'
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString)

function parseServerEvent(body: unknown): ServerEvent {
  const valid =
    isObject(body) &&
    typeof body.name === 'string' &&
    /^[\w.:-]{1,100}$/.test(body.name) &&
    isObject(body.consent) &&
    ['preferences', 'analytics', 'marketing'].every(
      (key) => typeof (body.consent as Record<string, unknown>)[key] === 'boolean',
    ) &&
    isOptional(body.id, isString) &&
    isOptional(body.url, isString) &&
    isOptional(body.clientId, isString) &&
    isOptional(body.params, isObject) &&
    isOptional(body.providers, isObject) &&
    isOptional(body.only, isStringArray) &&
    isOptional(body.categories, isStringArray) &&
    isOptional(
      body.identity,
      (identity) => isObject(identity) && Object.values(identity).every((value) => isOptional(value, isString)),
    )
  if (!valid) throw Object.assign(new Error('Invalid event'), { status: 400 })
  return body as ServerEvent
}

/**
 * A web-standard route handler for events forwarded by `createAnalytics({ server })`.
 * Only destinations that accept browser events (e.g. `metaCapi`) can be passed.
 */
export function createAnalyticsHandler(options: {
  destinations: (ServerDestination<true> | undefined)[]
  /** Grant only categories both the cookie `createConsentHandler` signs and the body grant; no valid cookie means denied. */
  consentCookie?: ConsentCookieOptions
  onError?: (error: unknown) => void
}): (request: Request) => Promise<Response> {
  if (options.consentCookie && !options.consentCookie.secret) {
    console.warn('[consentlayer] consentCookie.secret is not set: every event is treated as denied.')
  }
  const destinations = options.destinations.filter(
    (destination): destination is ServerDestination<true> => destination?.forwardBrowserEvents === true,
  )
  const names = destinations.every((destination) => destination.events !== undefined)
    ? [...new Set(destinations.flatMap((destination) => destination.events || []))].join(',')
    : undefined
  return async (request) => {
    try {
      if (options.consentCookie?.secret) assertSecret(options.consentCookie.secret)
      assertSameOrigin(request, { requireHeader: true })
      if (!destinations.length)
        return new Response(null, { status: 204, headers: { 'consentlayer-forwarding': 'off' } })
      const event = parseServerEvent(await parseJsonWithLimit(request, ANALYTICS_MAX_BODY))
      const proof = options.consentCookie && (await readConsentCookie(request, options.consentCookie))
      if (options.consentCookie) {
        const recorded = proof?.consent ?? { preferences: false, analytics: false, marketing: false }
        event.consent = Object.fromEntries(
          Object.entries(recorded).map(([key, value]) => [
            key,
            value === true && event.consent[key as keyof ConsentState] === true,
          ]),
        ) as ConsentState
      }
      const results = await sendServerEvent(event, {
        destinations,
        request: requestInfo(request),
      })
      for (const result of results) if (!result.ok) options.onError?.(result.error)
      const headers = new Headers()
      if (names !== undefined) headers.set('consentlayer-events', names)
      if (options.consentCookie && !proof) headers.set('consentlayer-consent', 'missing')
      return new Response(null, { status: 204, headers })
    } catch (error) {
      const status = (error as { status?: unknown }).status
      if (typeof status === 'number') return new Response(null, { status })
      options.onError?.(error)
      return new Response(null, { status: 500 })
    }
  }
}
