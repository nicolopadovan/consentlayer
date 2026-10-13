import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { ga4 } from '../src/providers/ga4'
import { meta } from '../src/providers/meta'

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

    const adapter = meta({
      pixelId: '123456789012345',
      serverEndpoint: '/api/facebook/track',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await adapter.track?.(
      {
        id: 'dedupe-123',
        name: 'purchase',
        params: { value: 10 },
        options: {},
      },
      {
        consent: {
          preferences: true,
          analytics: true,
          marketing: true,
        },
        identity: { email: 'demo@example.com' },
        debug: false,
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

  it('sets Meta consent before init', () => {
    const win = window as unknown as Record<string, unknown>
    delete win.__npcmMetaPixelInitialized
    delete win.__acmMetaPixelInitialized
    const adapter = meta({ pixelId: '123456789012345' })
    const append = vi.spyOn(document.head, 'appendChild')
    adapter.load?.({
      consent: { preferences: false, analytics: false, marketing: false },
      identity: {},
      debug: false,
      emitError: () => undefined,
    })
    const bootstrap = (append.mock.calls[0]?.[0] as HTMLScriptElement).text
    append.mockRestore()
    expect(document.head.querySelector('[data-analytics-consent-manager="meta-pixel-bootstrap"]')).toBeNull()
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeGreaterThan(-1)
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeLessThan(
      bootstrap.indexOf("fbq('init'"),
    )
  })

  it('configures GA4 only once analytics is granted', async () => {
    const win = window as unknown as Record<string, unknown>
    for (const key of ['dataLayer', 'gtag', '__npcmGa4Configured', '__acmGa4Configured']) delete win[key]
    const denied = { preferences: false, analytics: false, marketing: false }
    const manager = createAnalyticsManager({
      providers: [ga4({ measurementId: 'G-ABC123' })],
      consent: denied,
    })
    const commands = () =>
      (window.dataLayer ?? []).map((entry) => (entry.args as unknown[])[0])
    await manager.boot()
    expect(document.querySelector('script[src*="gtag/js?id=G-ABC123"]')).toBeTruthy()
    expect(commands()).not.toContain('config')
    await manager.updateConsent({ ...denied, analytics: true })
    expect(commands().filter((command) => command === 'config')).toHaveLength(1)
    manager.destroy()
  })
})
