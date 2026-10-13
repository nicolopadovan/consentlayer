// @vitest-environment node

import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsHandler, sendServerEvent } from '../src/server'
import { ga4Server } from '../src/server/ga4'
import { assertSameOrigin, parseJsonWithLimit } from '../src/server/http'
import { metaCapi } from '../src/server/meta'

const sha256 = (input: string) => createHash('sha256').update(input).digest('hex')

describe('request guards', () => {
  it('validates same-origin headers', () => {
    const request = (headers: Record<string, string>) => new Request('https://example.com/test', { headers })
    expect(() => assertSameOrigin(request({ origin: 'https://example.com' }), { requireHeader: true })).not.toThrow()
    expect(() => assertSameOrigin(request({ origin: 'https://evil.com' }))).toThrow(/cross-origin/)
    expect(() => assertSameOrigin(request({ referer: 'not a url' }))).toThrow(/malformed referer/)
    expect(() => assertSameOrigin(request({}), { requireHeader: true })).toThrow(/missing origin/)
  })

  it('parses bounded JSON bodies', async () => {
    const post = (body?: string) =>
      new Request('https://example.com/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
    await expect(parseJsonWithLimit(post('{"ok":true}'))).resolves.toEqual({ ok: true })
    await expect(parseJsonWithLimit(post(JSON.stringify({ blob: 'x'.repeat(32) })), 8)).rejects.toThrow(
      /Payload Too Large/,
    )
    await expect(parseJsonWithLimit(post())).rejects.toMatchObject({ status: 400 })
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
          params: { value: 3, kept: { ok: true } },
          identity: { email: 'Ada@Example.com', userId: 'u1' },
        },
        { cookie: '_fbp=fb.1.1.2; _ga=GA1.1.3.4', 'user-agent': 'UA', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      ),
    )
    expect(response.status).toBe(204)
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('graph.facebook.com/v26.0/123456789012345/events')
    const [event] = sentBody(fetchImpl).data as unknown[]
    expect(event).toMatchObject({
      event_name: 'PageView',
      event_id: 'evt-1',
      event_source_url: 'https://shop.example/p',
      custom_data: { value: 3, kept: { ok: true } },
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

  it('never forwards browser events to server-only destinations', async () => {
    const fetchImpl = okFetch()
    const ga = ga4Server({ measurementId: 'G-ABC123', apiSecret: 's', fetchImpl })
    // @ts-expect-error server-only destinations are rejected by the types too
    const POST = createAnalyticsHandler({ destinations: [ga] })
    expect((await POST(post({ name: 'x', consent: granted, clientId: 'c.1' }))).status).toBe(204)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('leaves out destinations whose id or secret is unset', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(metaCapi({ pixelId: '123456789012345', accessToken: undefined })).toBeUndefined()
    expect(metaCapi({ pixelId: '', accessToken: 'token' })).toBeUndefined()
    expect(ga4Server({ measurementId: 'G-ABC123', apiSecret: undefined })).toBeUndefined()
    expect(metaCapi({ pixelId: ' ', accessToken: ' ' })).toBeUndefined()
    expect(warn.mock.calls).toEqual([
      ['[consentlayer] metaCapi is off: set both pixelId and accessToken.'],
      ['[consentlayer] metaCapi is off: set both pixelId and accessToken.'],
      ['[consentlayer] ga4Server is off: set both measurementId and apiSecret.'],
    ])
    warn.mockRestore()
    const fetchImpl = okFetch()
    const ga = ga4Server({ measurementId: 'G-ABC123', apiSecret: 's', fetchImpl })
    const results = await sendServerEvent(
      { name: 'lead', consent: granted, clientId: 'c.1' },
      { destinations: [ga, metaCapi({ pixelId: undefined, accessToken: undefined })] },
    )
    expect(results).toEqual([{ id: 'ga4', ok: true }])
    const POST = createAnalyticsHandler({ destinations: [metaCapi({ pixelId: undefined, accessToken: 'token' })] })
    expect((await POST(post({ name: 'x', consent: granted }))).status).toBe(204)
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
      { name: 'purchase', consent: granted, clientId: 'c.1', identity: { email: ' A@B.co', phone: '39 333 123 4567' } },
      { destinations: [ga] },
    )
    expect(sentBody(fetchImpl, 1)).toMatchObject({
      client_id: 'c.1',
      user_data: { sha256_email_address: sha256('a@b.co'), sha256_phone_number: sha256('+393331234567') },
      consent: { ad_user_data: 'GRANTED' },
    })

    await sendServerEvent(
      { name: 'purchase', consent: granted, clientId: 'c.1', identity: { email: 'nope', phone: '12' } },
      { destinations: [ga] },
    )
    expect(sentBody(fetchImpl, 2)).not.toHaveProperty('user_data')
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
