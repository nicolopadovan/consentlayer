import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { loadScript } from '../src/core/plugin'
import { ga4 } from '../src/providers/ga4'
import { meta } from '../src/providers/meta'

describe('providers', () => {
  it('reuses the same Meta event id for browser and server dedupe', async () => {
    const fbq = vi.fn()
    ;(window as unknown as { fbq?: typeof fbq }).fbq = fbq
    ;(window as unknown as { __consentlayerMetaPixelInitialized?: boolean }).__consentlayerMetaPixelInitialized = true
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
    delete win.__consentlayerMetaPixelInitialized
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
    expect(document.head.querySelector('[data-consentlayer="meta-pixel-bootstrap"]')).toBeNull()
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeGreaterThan(-1)
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeLessThan(
      bootstrap.indexOf("fbq('init'"),
    )
  })

  it('configures GA4 only once analytics is granted', async () => {
    const win = window as unknown as Record<string, unknown>
    for (const key of ['dataLayer', 'gtag', '__consentlayerGa4Configured', '__acmGa4Configured']) delete win[key]
    const denied = { preferences: false, analytics: false, marketing: false }
    const manager = createAnalyticsManager({
      providers: [ga4({ measurementId: 'G-ABC123' })],
      consent: denied,
    })
    const commands = () =>
      (window.dataLayer ?? []).map((entry) => {
        expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
        return (entry as ArrayLike<unknown>)[0]
      })
    await manager.boot()
    expect(document.querySelector('script[src*="gtag/js?id=G-ABC123"]')).toBeNull()
    await manager.updateConsent({ ...denied, analytics: true })
    expect(document.querySelector('script[src*="gtag/js?id=G-ABC123"]')).toBeTruthy()
    expect(commands().filter((command) => command === 'config')).toHaveLength(1)
    manager.destroy()
  })
})

describe('loadScript', () => {
  it('adds a relative src once and shares the pending load', async () => {
    const first = loadScript('/lib.js')
    const second = loadScript('/lib.js')
    const scripts = [...document.scripts].filter((script) => script.src.endsWith('/lib.js'))
    expect(scripts).toHaveLength(1)
    expect(second).toBe(first)
    scripts[0].dispatchEvent(new Event('load'))
    await expect(first).resolves.toBeUndefined()
  })

  it('retries after a failed load', async () => {
    const failed = loadScript('/broken.js')
    document.querySelector<HTMLScriptElement>('script[src$="/broken.js"]')!.dispatchEvent(new Event('error'))
    await expect(failed).rejects.toThrow('Failed to load /broken.js')
    void loadScript('/broken.js')
    expect(document.querySelectorAll('script[src$="/broken.js"]')).toHaveLength(1)
  })
})
