import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('example api routes', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    vi.resetModules()
    fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      text: () => Promise.resolve('ok'),
      status: 200,
    } as Response)
    global.fetch = fetchMock
  })

  it('wires the Meta route to the shared server helpers', async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_FACEBOOK_PIXEL_ID: '123',
      META_TOKEN: 'secret',
      FACEBOOK_TEST_EVENT_CODE: 'TEST123',
    })
    const { POST } = await import('./api/facebook/track/route')
    const response = await POST(
      new Request('https://example.com/api/facebook/track', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://example.com',
          cookie: '_fbp=fbp-cookie; _fbc=fbc-cookie',
        },
        body: JSON.stringify({
          event_name: 'Purchase',
          event_id: 'evt-1',
          custom_data: { value: 12 },
          user: { email: 'demo@example.com' },
        }),
      }),
    )

    const json = (await response.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    const metaUrl = fetchMock.mock.calls[0]?.[0]
    expect(typeof metaUrl).toBe('string')
    if (typeof metaUrl !== 'string') {
      throw new Error('Expected Meta fetch url to be a string')
    }
    expect(metaUrl).toContain('TEST123')
    const requestInit = fetchMock.mock.calls[0]?.[1]
    const bodyText = requestInit?.body
    expect(typeof bodyText).toBe('string')
    if (typeof bodyText !== 'string') {
      throw new Error('Expected Meta request body to be a string')
    }
    const body = JSON.parse(bodyText) as {
      data: Array<{ user_data: { em?: string } }>
    }
    expect(
      body.data[0]?.user_data.em,
    ).toBeTruthy()
  })

  it('wires the GA4 route to the shared server helpers', async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: 'G-123',
      GA4_API_SECRET: 'ga-secret',
    })
    const { POST } = await import('./api/ga4/track/route')
    const response = await POST(
      new Request('https://example.com/api/ga4/track', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://example.com',
        },
        body: JSON.stringify({
          event_name: 'purchase',
          client_id: 'client-1',
          params: { value: 99 },
        }),
      }),
    )

    const json = (await response.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    const gaUrl = fetchMock.mock.calls[0]?.[0]
    expect(typeof gaUrl).toBe('string')
    if (typeof gaUrl !== 'string') {
      throw new Error('Expected GA4 fetch url to be a string')
    }
    expect(gaUrl).toContain('measurement_id=G-123')
  })
})
