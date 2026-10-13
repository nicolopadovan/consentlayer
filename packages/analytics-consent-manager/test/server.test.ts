// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  ANALYTICS_MAX_BODY,
  assertSameOrigin,
  createAnalyticsHandler,
  sendServerEvent,
  createGa4CollectUrl,
  createGa4MeasurementPayload,
  createMetaEventPayload,
  parseJsonWithLimit,
  sanitizeMetaCustomData,
  sha256,
} from '../src/server'
import { ga4Server } from '../src/server/ga4'
import { metaCapi } from '../src/server/meta'

describe('server helpers', () => {
  it('validates same-origin headers', () => {
    const allowed = new Request('https://example.com/test', {
      headers: { origin: 'https://example.com' },
    })
    expect(() => assertSameOrigin(allowed, { requireHeader: true })).not.toThrow()

    const blocked = new Request('https://example.com/test', {
      headers: { origin: 'https://evil.com' },
    })
    expect(() => assertSameOrigin(blocked, { requireHeader: true })).toThrow(
      /cross-origin/,
    )
  })

  it('parses bounded JSON bodies', async () => {
    const request = new Request('https://example.com/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    })
    await expect(parseJsonWithLimit<{ ok: boolean }>(request, ANALYTICS_MAX_BODY)).resolves.toEqual({
      ok: true,
    })

    const oversized = new Request('https://example.com/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blob: 'x'.repeat(32) }),
    })
    await expect(parseJsonWithLimit(oversized, 8)).rejects.toThrow(
      /Payload Too Large/,
    )
  })

  it('shapes and sanitizes Meta payloads', () => {
    const payload = createMetaEventPayload({
      eventName: 'Purchase',
      eventId: 'evt-1',
      eventSourceUrl: 'https://example.com',
      customData: {
        valid: true,
        nested: { ok: true },
        invalid: () => undefined,
      },
      user: {
        email: 'Demo@Example.com',
        phone: '+39 333 123 4567',
        external_id: 'user-1',
      },
      cookieHeader: '_fbp=fbp123; _fbc=fbc123',
    })

    expect(payload.data[0].event_id).toBe('evt-1')
    expect(payload.data[0].custom_data).toEqual({
      valid: true,
      nested: { ok: true },
      currency: 'EUR',
    })
    expect(payload.data[0].user_data.em).toBe(sha256('demo@example.com'))
    expect(payload.data[0].user_data.fbp).toBe('fbp123')
  })

  it('builds GA4 measurement payloads and urls', () => {
    expect(
      createGa4MeasurementPayload({
        clientId: 'client-1',
        userId: 'user-1',
        eventName: 'purchase',
        params: { value: 42 },
      }),
    ).toEqual({
      client_id: 'client-1',
      user_id: 'user-1',
      events: [{ name: 'purchase', params: { value: 42 } }],
    })

    expect(
      createGa4CollectUrl({
        measurementId: 'G-123',
        apiSecret: 'secret',
      }),
    ).toContain('measurement_id=G-123')
    expect(sanitizeMetaCustomData({ value: 99 }, { currency: 'EUR' })).toEqual({
      value: 99,
      currency: 'EUR',
    })
  })
})

describe('server destinations', () => {
  const granted = { preferences: true, analytics: true, marketing: true }
  const okFetch = () => vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request('https://shop.example/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://shop.example', ...headers },
      body: JSON.stringify(body),
    })
  const sentBody = (fetchMock: ReturnType<typeof okFetch>, call = 0) =>
    JSON.parse(fetchMock.mock.calls[call]?.[1]?.body as string) as Record<string, unknown>

  it('forwards a browser event to Meta CAPI with cookies, headers and hashed identity', async () => {
    const fetchImpl = okFetch()
    const POST = createAnalyticsHandler({
      destinations: [metaCapi({ pixelId: '123456789012345', accessToken: 'token', fetchImpl })],
    })
    const response = await POST(
      post(
        {
          id: 'evt-1',
          name: 'page_view',
          url: 'https://shop.example/p',
          consent: granted,
          identity: { email: 'Ada@Example.com', userId: 'u1' },
        },
        { cookie: '_fbp=fb.1.1.2; _ga=GA1.1.3.4', 'user-agent': 'UA', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      ),
    )
    expect(response.status).toBe(204)
    const [event] = sentBody(fetchImpl).data as unknown[]
    expect(event).toMatchObject({
      event_name: 'PageView',
      event_id: 'evt-1',
      event_source_url: 'https://shop.example/p',
      user_data: {
        client_ip_address: '1.2.3.4',
        client_user_agent: 'UA',
        fbp: 'fb.1.1.2',
        em: sha256('ada@example.com'),
        external_id: sha256('u1'),
      },
    })
  })

  it('rejects bad input and drops events whose consent excludes the destination', async () => {
    const fetchImpl = okFetch()
    const POST = createAnalyticsHandler({
      destinations: [metaCapi({ pixelId: '123456789012345', accessToken: 'token', fetchImpl })],
    })
    expect((await POST(post({ name: 'x' }))).status).toBe(400)
    expect((await POST(post({ name: 'x', consent: granted }, { origin: 'https://evil.example' }))).status).toBe(403)
    expect(
      (await POST(post({ name: 'x', consent: { ...granted, marketing: false } }))).status,
    ).toBe(204)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports vendor failures through onError', async () => {
    const onError = vi.fn()
    const POST = createAnalyticsHandler({
      destinations: [
        metaCapi({
          pixelId: '123456789012345',
          accessToken: 'token',
          fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response('bad', { status: 400 })),
        }),
      ],
      onError,
    })
    expect((await POST(post({ name: 'sign_up', consent: granted }))).status).toBe(204)
    expect(String(onError.mock.calls[0]?.[0])).toMatch(/Meta CAPI 400/)
  })

  it('sends server-only events to GA4 with the cookie client id and consent', async () => {
    const fetchImpl = okFetch()
    const ga = ga4Server({ measurementId: 'G-ABC123', apiSecret: 's', fetchImpl })
    const results = await sendServerEvent(
      { name: 'lead', params: { value: 5 }, consent: { ...granted, marketing: false }, identity: { userId: 'u1', email: 'a@b.co' } },
      { destinations: [ga], request: { cookies: { _ga: 'GA1.1.111.222' } } },
    )
    expect(results).toEqual([{ id: 'ga4', ok: true }])
    expect(sentBody(fetchImpl)).toEqual({
      client_id: '111.222',
      user_id: 'u1',
      consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
      events: [{ name: 'generate_lead', params: { value: 5 } }],
    })

    await sendServerEvent(
      { name: 'purchase', consent: granted, clientId: 'c.1', identity: { email: ' A@B.co', phone: '39 333' } },
      { destinations: [ga] },
    )
    expect(sentBody(fetchImpl, 1)).toMatchObject({
      client_id: 'c.1',
      user_data: { sha256_email_address: sha256('a@b.co'), sha256_phone_number: sha256('+39333') },
      consent: { ad_user_data: 'GRANTED' },
    })
  })

  it('fails GA4 without a client id and honours only', async () => {
    const fetchImpl = okFetch()
    const ga = ga4Server({ measurementId: 'G-ABC123', apiSecret: 's', fetchImpl })
    const meta = metaCapi({ pixelId: '123456789012345', accessToken: 't', fetchImpl })
    const results = await sendServerEvent(
      { name: 'purchase', consent: granted, only: ['ga4'] },
      { destinations: [ga, meta] },
    )
    expect(results).toMatchObject([{ id: 'ga4', ok: false }])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
