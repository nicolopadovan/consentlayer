import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { loadScript } from '../src/core/plugin'
import { contentsquare } from '../src/providers/contentsquare'
import { ga4 } from '../src/providers/ga4'
import { hotjar } from '../src/providers/hotjar'
import { meta } from '../src/providers/meta'
import { posthog } from '../src/providers/posthog'
import { sentry } from '../src/providers/sentry'

describe('providers', () => {
  it('turns a provider off when its id is unset, but still rejects a malformed one', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    const skipped = [
      ga4({ measurementId: undefined }),
      meta({ pixelId: '' }),
      posthog({ apiKey: undefined }),
      sentry({ dsn: undefined }),
      contentsquare({ tagId: undefined }),
      hotjar({ siteId: '', version: 6 }),
    ]
    expect(skipped.map((plugin) => Object.keys(plugin))).toEqual(skipped.map(() => ['id', 'setup']))

    const manager = createAnalyticsManager({
      providers: skipped,
      consent: { preferences: true, analytics: true, marketing: true },
      debug: true,
    })
    await manager.boot()
    await manager.track('purchase', { transaction_id: 'o1', value: 10 })
    expect(debug).toHaveBeenCalledWith('[consentlayer]', 'ga4 is off: measurementId is not set.')
    expect(debug).toHaveBeenCalledWith('[consentlayer]', 'meta is off: pixelId is not set.')
    manager.destroy()
    debug.mockRestore()

    expect(() => ga4({ measurementId: 'UA-12345' })).toThrow(/GA4 measurement ID/)
    expect(() => meta({ pixelId: 'pixel-123' })).toThrow(/Meta Pixel ID/)
    expect(() => hotjar({ siteId: 'abc', version: '6' })).toThrow(/Hotjar siteId or version/)
    expect(hotjar({ siteId: ' 123\n', version: '6' }).load).toBeTypeOf('function')
    for (const siteId of ['1e3', '0x10', '12.0', '0']) {
      expect(() => hotjar({ siteId, version: 6 })).toThrow(/Hotjar siteId or version/)
    }
    expect(Object.keys(hotjar({ siteId: ' ', version: 6 }))).toEqual(['id', 'setup'])
    expect(ga4({ measurementId: ' G-ABC123\n' }).load).toBeTypeOf('function')
    expect(meta({ pixelId: '123456789012345\n' }).load).toBeTypeOf('function')
    expect(Object.keys(posthog({ apiKey: ' ' }))).toEqual(['id', 'setup'])
  })

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

  it('stops forwarding once the route reports no destination', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204, headers: { 'consentlayer-forwarding': 'off' } }))
    vi.stubGlobal('fetch', fetchMock)
    const manager = createAnalyticsManager({
      consent: { preferences: true, analytics: true, marketing: true },
      server: { endpoint: '/api/analytics' },
    })
    await manager.boot()
    await manager.page()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    await manager.track('sign_up')
    await manager.page()
    vi.unstubAllGlobals()
    expect(fetchMock).toHaveBeenCalledTimes(1)
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
    void adapter.load?.({
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

describe('contentsquare', () => {
  it('sends SPA pageviews, events, purchases and identity, and opts out on withdrawal', async () => {
    const granted = { preferences: false, analytics: true, marketing: false }
    const manager = createAnalyticsManager({ providers: [contentsquare({ tagId: 'abc123def4567' })], consent: granted })
    await manager.boot()
    expect(document.querySelector('script[src="https://t.contentsquare.net/uxa/abc123def4567.js"]')).not.toBeNull()

    await manager.page()
    history.pushState({}, '', '/products/mug?ref=x')
    await manager.page()
    await manager.track('sign_up')
    await manager.track('purchase', { transaction_id: 'o1', value: 10, currency: 'EUR' })
    await manager.identify('u_42')
    expect(window._uxa).toEqual([
      ['trackPageview', '/products/mug'],
      ['trackPageEvent', 'sign_up'],
      ['ec:transaction:create', { id: 'o1', revenue: 10, currency: 'EUR' }],
      ['ec:transaction:send'],
      ['identify', 'u_42'],
    ])

    await manager.updateConsent({ ...granted, analytics: false })
    expect(window._uxa?.at(-1)).toEqual(['optout'])

    document.cookie = '_cs_optout=1; path=/'
    await manager.updateConsent(granted)
    expect(document.cookie).not.toContain('_cs_optout')
    manager.destroy()
    history.pushState({}, '', '/')
  })
})
