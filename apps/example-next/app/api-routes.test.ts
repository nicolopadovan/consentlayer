import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('example api route', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    vi.resetModules()
    fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    global.fetch = fetchMock
  })

  it('forwards browser events to Meta CAPI', async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_FACEBOOK_PIXEL_ID: '123456789012345',
      META_TOKEN: 'secret',
      FACEBOOK_TEST_EVENT_CODE: 'TEST123',
    })
    const { POST } = await import('./api/analytics/route')
    const response = await POST(
      new Request('https://example.com/api/analytics', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://example.com',
          cookie: '_fbp=fbp-cookie; _fbc=fbc-cookie',
        },
        body: JSON.stringify({
          id: 'evt-1',
          name: 'purchase',
          params: { transaction_id: 'o1', value: 12, currency: 'EUR' },
          consent: { preferences: true, analytics: true, marketing: true },
          identity: { email: 'demo@example.com' },
        }),
      }),
    )

    expect(response.status).toBe(204)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toContain('TEST123')
    const body = JSON.parse(init?.body as string) as {
      data: Array<{ event_name: string; event_id: string; user_data: { em?: string; fbp?: string } }>
    }
    expect(body.data[0]).toMatchObject({
      event_name: 'Purchase',
      event_id: 'evt-1',
      user_data: { fbp: 'fbp-cookie' },
    })
    expect(body.data[0]?.user_data.em).toBeTruthy()
  })
})
