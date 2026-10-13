import crypto from 'node:crypto'
import { isValidEmail, isValidPhoneE164 } from '../core/validation'
import { parseCookieHeader } from './http'
import { toMetaEvent } from '../core/meta-events'
import type { ServerDestination } from './handler'

export type MetaUserDataInput = {
  email?: string
  phone?: string
  external_id?: string
  fbc?: string
  fbp?: string
}

export type MetaEventInput = {
  eventName?: string
  eventId?: string
  eventSourceUrl?: string
  value?: number
  currency?: string
  customData?: Record<string, unknown>
  user?: MetaUserDataInput
  clientIpAddress?: string
  clientUserAgent?: string
  cookieHeader?: string
}

export function sha256(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function extractMetaCookies(cookieHeader: string): {
  fbc?: string
  fbp?: string
} {
  const cookies = parseCookieHeader(cookieHeader)
  return {
    fbc: cookies._fbc,
    fbp: cookies._fbp,
  }
}

export function sanitizeMetaCustomData(
  customData: Record<string, unknown> = {},
  fallback: { value?: number; currency?: string } = {},
): Record<string, unknown> {
  const merged = { ...customData }
  if (fallback.value !== undefined && merged.value === undefined) {
    merged.value = fallback.value
  }
  if (fallback.currency && merged.currency === undefined) {
    merged.currency = fallback.currency
  }
  if (!merged.currency) {
    merged.currency = fallback.currency ?? 'EUR'
  }
  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => {
      return (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        Array.isArray(value) ||
        (typeof value === 'object' &&
          value !== null &&
          value.constructor === Object)
      )
    }),
  )
}

export function createMetaEventPayload(input: MetaEventInput) {
  const cookies = extractMetaCookies(input.cookieHeader ?? '')
  const normalizedEmail = input.user?.email
    ? input.user.email.toLowerCase().trim()
    : undefined
  const normalizedPhone = input.user?.phone
    ? `+${input.user.phone.replace(/\D/g, '')}`
    : undefined
  return {
    data: [
      {
        event_name: input.eventName ?? 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: 'website',
        custom_data: sanitizeMetaCustomData(input.customData, {
          value: input.value,
          currency: input.currency,
        }),
        user_data: {
          client_ip_address: input.clientIpAddress,
          client_user_agent: input.clientUserAgent,
          fbp: input.user?.fbp ?? cookies.fbp,
          fbc: input.user?.fbc ?? cookies.fbc,
          em:
            normalizedEmail && isValidEmail(normalizedEmail)
              ? sha256(normalizedEmail)
              : undefined,
          ph:
            normalizedPhone && isValidPhoneE164(normalizedPhone)
              ? sha256(normalizedPhone.slice(1))
              : undefined,
          external_id: input.user?.external_id
            ? sha256(input.user.external_id)
            : undefined,
        },
      },
    ],
  }
}

export function createMetaGraphUrl(input: {
  pixelId: string
  accessToken: string
  testEventCode?: string
  apiVersion?: string
}): string {
  const version = input.apiVersion ?? 'v18.0'
  const url = new URL(
    `https://graph.facebook.com/${version}/${input.pixelId}/events`,
  )
  url.searchParams.set('access_token', input.accessToken)
  if (input.testEventCode) {
    url.searchParams.set('test_event_code', input.testEventCode)
  }
  return url.toString()
}

export async function sendMetaCapiEvent(input: {
  pixelId: string
  accessToken: string
  testEventCode?: string
  apiVersion?: string
  payload: ReturnType<typeof createMetaEventPayload>
  fetchImpl?: typeof fetch
}) {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  if (!fetchImpl) {
    throw new Error('fetch is required to send Meta CAPI events')
  }
  return fetchImpl(
    createMetaGraphUrl({
      pixelId: input.pixelId,
      accessToken: input.accessToken,
      testEventCode: input.testEventCode,
      apiVersion: input.apiVersion,
    }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    },
  )
}

/** Meta Conversions API. Receives browser events too; Meta dedupes them by event ID. */
export function metaCapi(options: {
  pixelId: string
  accessToken: string
  testEventCode?: string
  fetchImpl?: typeof fetch
}): ServerDestination<true> {
  return {
    id: 'meta',
    requiredConsent: 'marketing',
    forwardBrowserEvents: true,
    async send(event, request) {
      const { name, params } = toMetaEvent({
        id: event.id ?? '',
        name: event.name,
        params: event.params ?? {},
        options: { providers: event.providers },
      })
      const response = await sendMetaCapiEvent({
        ...options,
        payload: createMetaEventPayload({
          eventName: name,
          eventId: event.id,
          eventSourceUrl: event.url,
          customData: params,
          user: {
            email: event.identity?.email,
            phone: event.identity?.phone,
            external_id: event.identity?.userId,
            fbc: request?.cookies._fbc,
            fbp: request?.cookies._fbp,
          },
          clientIpAddress: request?.ip,
          clientUserAgent: request?.userAgent,
        }),
      })
      if (!response.ok) throw new Error(`Meta CAPI ${response.status}: ${await response.text()}`)
    },
  }
}
