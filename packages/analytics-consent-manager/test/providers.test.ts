import { describe, expect, it, vi } from 'vitest'
import { createMetaAdapter } from '../src/providers/meta'

describe('providers', () => {
  it('reuses the same Meta event id for browser and server dedupe', async () => {
    const fbq = vi.fn()
    ;(window as unknown as { fbq?: typeof fbq; __acmMetaPixelInitialized?: boolean }).fbq =
      fbq
    ;(
      window as unknown as { __acmMetaPixelInitialized?: boolean }
    ).__acmMetaPixelInitialized = true

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const adapter = createMetaAdapter({
      pixelId: '123456789012345',
      serverEndpoint: '/api/facebook/track',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await adapter.trackEvent?.(
      {
        name: 'Purchase',
        params: { value: 10 },
        options: { eventId: 'dedupe-123' },
      },
      {
        consent: {
          preferences: true,
          analytics: true,
          marketing: true,
        },
        identity: { email: 'demo@example.com' },
        debug: false,
        isBooted: true,
        emitError: () => undefined,
      },
    )

    expect(fbq).toHaveBeenCalledWith(
      'track',
      'Purchase',
      { value: 10 },
      { eventID: 'dedupe-123' },
    )

    const body = JSON.parse(
      (fetchImpl.mock.calls[0]?.[1] as { body: string }).body,
    ) as { event_id: string }
    expect(body.event_id).toBe('dedupe-123')
  })

  it('sets Meta consent before init', async () => {
    const win = window as unknown as Record<string, unknown>
    delete win.__npcmMetaPixelInitialized
    delete win.__acmMetaPixelInitialized
    const adapter = createMetaAdapter({ pixelId: '123456789012345' })
    await adapter.setup?.({
      consent: { preferences: false, analytics: false, marketing: false },
      identity: {},
      debug: false,
      isBooted: true,
      emitError: () => undefined,
    })
    const bootstrap = document.head.querySelector(
      'script[data-analytics-consent-manager="meta-pixel-bootstrap"]',
    )?.textContent ?? ''
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeGreaterThan(-1)
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeLessThan(
      bootstrap.indexOf("fbq('init'"),
    )
  })
})
