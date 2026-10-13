import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { ga4 } from '../src/providers/ga4'
import { meta } from '../src/providers/meta'

describe('providers', () => {
  it('reuses the same Meta event id for browser and server dedupe', async () => {
    const fbq = vi.fn()
    ;(window as unknown as { fbq?: typeof fbq }).fbq = fbq
    ;(window as unknown as { __npcmMetaPixelInitialized?: boolean }).__npcmMetaPixelInitialized = true
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const pixel = meta({ pixelId: '123456789012345' })
    const manager = createAnalyticsManager({
      providers: [{ ...pixel, load: undefined }],
      consent: { preferences: true, analytics: true, marketing: true },
      server: { endpoint: '/api/analytics' },
    })
    await manager.boot()
    await manager.track('purchase', { transaction_id: 'o1', value: 10 }, { eventId: 'dedupe-123' })
    vi.unstubAllGlobals()

    expect(fbq).toHaveBeenCalledWith(
      'track',
      'Purchase',
      { transaction_id: 'o1', value: 10 },
      { eventID: 'dedupe-123' },
    )
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/analytics')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      id: 'dedupe-123',
      name: 'purchase',
      consent: { marketing: true },
    })
    manager.destroy()
  })

  it('forwards nothing to the server without analytics or marketing consent', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    const manager = createAnalyticsManager({
      consent: { preferences: true, analytics: false, marketing: false },
      server: { endpoint: '/api/analytics' },
    })
    await manager.boot()
    await manager.track('sign_up')
    await manager.page()
    vi.unstubAllGlobals()
    expect(fetchMock).not.toHaveBeenCalled()
    manager.destroy()
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
