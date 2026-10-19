// @vitest-environment node

import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsHandler, sendServerEvent, type ServerDestination } from '../src/server'
import { ga4Server } from '../src/server/ga4'
import { assertSameOrigin, parseJsonWithLimit } from '../src/server/http'
import { metaCapi } from '../src/server/meta'
import { sgtm } from '../src/server/sgtm'
import { tiktokEvents } from '../src/server/tiktok'

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

  it('sends Meta CAPI and the TikTok Events API only standard events, the names in events, or an event whose only names them', async () => {
    const sentNames = async (events?: string[]) => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(Response.json({ code: 0 })))
      const POST = createAnalyticsHandler({
        destinations: [
          metaCapi({ pixelId: '123456789012345', accessToken: 'token', events, fetchImpl }),
          tiktokEvents({ pixelId: 'CABC123', accessToken: 'token', events, fetchImpl }),
        ],
      })
      for (const name of ['lead', 'scroll_depth', 'filter_changed']) await POST(post({ name, consent: granted }))
      await POST(post({ name: 'share', consent: granted, only: ['meta', 'tiktok'] }))
      return fetchImpl.mock.calls.map((_, call) => {
        const [event] = sentBody(fetchImpl, call).data as { event_name?: string; event?: string }[]
        return event?.event_name ?? event?.event
      })
    }
    expect(await sentNames()).toEqual(['Lead', 'Lead', 'share', 'share'])
    expect(await sentNames(['filter_changed'])).toEqual(['filter_changed', 'filter_changed', 'share', 'share'])
  })

  it('rejects bad input and drops events whose consent excludes the destination', async () => {
    const fetchImpl = okFetch()
    const POST = createAnalyticsHandler({
      destinations: [metaCapi({ pixelId: '123456789012345', accessToken: 'token', fetchImpl })],
    })
    expect((await POST(post({ name: 'x' }))).status).toBe(400)
    expect((await POST(post({ name: 'x', consent: granted }, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await POST(post({ name: 'x', consent: { ...granted, marketing: false } }))).status).toBe(204)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('follows the event consent for a request with Sec-GPC: 1', async () => {
    const fetchImpl = okFetch()
    const POST = createAnalyticsHandler({
      destinations: [metaCapi({ pixelId: '123456789012345', accessToken: 'token', fetchImpl })],
    })
    await POST(post({ name: 'lead', consent: { ...granted, marketing: false } }, { 'sec-gpc': '1' }))
    expect(fetchImpl).not.toHaveBeenCalled()
    await POST(post({ name: 'lead', consent: granted }, { 'sec-gpc': '1' }))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
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
    const response = await POST(post({ name: 'x', consent: granted }))
    expect(response.status).toBe(204)
    expect(response.headers.get('consentlayer-forwarding')).toBe('off')
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

  it('forwards browser events to a server-side GTM container as Measurement Protocol requests', async () => {
    const fetchImpl = okFetch()
    const POST = createAnalyticsHandler({
      destinations: [
        sgtm({ url: 'https://sgtm.example.com/mp/collect', measurementId: 'G-ABC123', apiSecret: 's', fetchImpl }),
      ],
    })
    await POST(
      post(
        { name: 'page_view', url: 'https://shop.example/a', consent: { ...granted, marketing: false } },
        { cookie: '_ga=GA1.1.111.222' },
      ),
    )
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://sgtm.example.com/mp/collect?measurement_id=G-ABC123&api_secret=s',
    )
    expect(sentBody(fetchImpl)).toEqual({
      client_id: '111.222',
      consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
      events: [{ name: 'page_view', params: { page_location: 'https://shop.example/a' } }],
    })
    await POST(post({ name: 'page_view', consent: { ...granted, analytics: false } }, { cookie: '_ga=GA1.1.111.222' }))
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(sgtm({ url: 'https://sgtm.example.com/mp/collect', measurementId: undefined })).toBeUndefined()
    expect(warn).toHaveBeenCalledWith('[consentlayer] sgtm is off: set both url and measurementId.')
    warn.mockRestore()
    expect(() => sgtm({ url: 'http://sgtm.example.com/mp/collect', measurementId: 'G-ABC123' })).toThrow('HTTPS')
  })

  it('sends a destination only the events in its `events` option, page views included, unless `only` names it', async () => {
    const send = vi.fn<ServerDestination['send']>(() => Promise.resolve())
    const destination: ServerDestination = {
      id: 'd',
      requiredConsent: 'analytics',
      forwardBrowserEvents: true,
      events: false,
      send,
    }
    for (const event of [{ name: 'page_view' }, { name: 'purchase' }, { name: 'share', only: ['d'] }])
      await sendServerEvent({ ...event, consent: granted }, { destinations: [destination] })
    expect(send.mock.calls.map(([event]) => event.name)).toEqual(['share'])
    send.mockClear()
    destination.events = ['page_view']
    for (const event of [{ name: 'page_view' }, { name: 'purchase' }])
      await sendServerEvent({ ...event, consent: granted }, { destinations: [destination] })
    expect(send.mock.calls.map(([event]) => event.name)).toEqual(['page_view'])
  })

  it('tells the browser which events its destinations take', async () => {
    const destination = (events?: readonly string[] | false): ServerDestination<true> => ({
      id: 'd',
      requiredConsent: 'analytics',
      forwardBrowserEvents: true,
      events,
      send: () => Promise.resolve(),
    })
    const header = async (...destinations: ServerDestination<true>[]) =>
      (await createAnalyticsHandler({ destinations })(post({ name: 'lead', consent: granted }))).headers.get(
        'consentlayer-events',
      )
    expect(await header(destination(['lead', 'sign_up']), destination(['lead']), destination(false))).toBe(
      'lead,sign_up',
    )
    expect(await header(destination(false))).toBe('')
    expect(await header(destination(['lead']), destination())).toBeNull()
  })

  it('sends server-only events to GA4 with the cookie client id and consent', async () => {
    const fetchImpl = okFetch()
    const ga = ga4Server({ measurementId: 'G-ABC123', apiSecret: 's', fetchImpl })
    const results = await sendServerEvent(
      {
        name: 'lead',
        params: { value: 5 },
        consent: { ...granted, marketing: false },
        identity: { userId: 'u1', email: 'a@b.co' },
      },
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

    for (const email of ['Ada.Love.Lace@GMail.com', 'ada.lovelace@googlemail.com', 'ada.love@example.com']) {
      await sendServerEvent(
        { name: 'x', consent: granted, clientId: 'c.1', identity: { email } },
        { destinations: [ga] },
      )
    }
    expect([3, 4, 5].map((call) => sentBody(fetchImpl, call).user_data)).toEqual([
      { sha256_email_address: sha256('adalovelace@gmail.com') },
      { sha256_email_address: sha256('adalovelace@googlemail.com') },
      { sha256_email_address: sha256('ada.love@example.com') },
    ])
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

  it('sends only to destinations that require one of the event categories', async () => {
    const fetchImpl = okFetch()
    const ga = ga4Server({ measurementId: 'G-ABC123', apiSecret: 's', fetchImpl })
    const meta = metaCapi({ pixelId: '123456789012345', accessToken: 't', fetchImpl })
    const results = await sendServerEvent(
      { name: 'page_view', consent: granted, url: 'https://example.com/', categories: ['marketing'] },
      { destinations: [ga, meta] },
    )
    expect(results).toEqual([{ id: 'meta', ok: true }])
  })

  it('forwards a browser event to the TikTok Events API with the browser event id and hashed identity', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 0, message: 'OK' }))
    const POST = createAnalyticsHandler({
      destinations: [tiktokEvents({ pixelId: 'CABC123', accessToken: 'token', testEventCode: 'TEST1', fetchImpl })],
    })
    const body = {
      id: 'evt-1',
      name: 'add_to_cart',
      url: 'https://shop.example/p',
      consent: granted,
      params: { value: 9.2, currency: 'USD', items: [{ item_id: 'sku' }] },
      identity: { email: ' Ada@Example.com', phone: '+1 213 373 4253', userId: 'u1' },
    }
    const headers = { cookie: '_ttp=ttp-1; ttclid=click-1', 'user-agent': 'UA', 'x-forwarded-for': '1.2.3.4' }
    expect((await POST(post(body, headers))).status).toBe(204)
    expect((await POST(post({ ...body, name: 'page_view' }, headers))).status).toBe(204)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://business-api.tiktok.com/open_api/v1.3/event/track/')
    expect(init?.headers).toEqual({ 'Access-Token': 'token', 'Content-Type': 'application/json' })
    expect(sentBody(fetchImpl)).toMatchObject({
      event_source: 'web',
      event_source_id: 'CABC123',
      test_event_code: 'TEST1',
      data: [
        {
          event: 'AddToCart',
          event_id: 'evt-1',
          user: {
            email: sha256('ada@example.com'),
            phone: sha256('+12133734253'),
            external_id: sha256('u1'),
            ip: '1.2.3.4',
            user_agent: 'UA',
            ttp: 'ttp-1',
            ttclid: 'click-1',
          },
          properties: {
            value: 9.2,
            currency: 'USD',
            content_ids: ['sku'],
            content_type: 'product',
            contents: [{ content_id: 'sku', quantity: 1 }],
          },
          page: { url: 'https://shop.example/p' },
        },
      ],
    })
  })

  it('fails when TikTok answers with a non-zero code, and warns when only one credential is set', async () => {
    const tiktok = tiktokEvents({
      pixelId: 'CABC123',
      accessToken: 'token',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 40001, message: 'Invalid token' })),
    })
    const [result] = await sendServerEvent({ name: 'lead', consent: granted }, { destinations: [tiktok] })
    expect(String(result?.error)).toMatch('TikTok Events API 40001: Invalid token')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(tiktokEvents({ pixelId: 'CABC123', accessToken: undefined })).toBeUndefined()
    expect(tiktokEvents({ pixelId: '', accessToken: '' })).toBeUndefined()
    expect(warn.mock.calls).toEqual([['[consentlayer] tiktokEvents is off: set both pixelId and accessToken.']])
    warn.mockRestore()
  })
})
