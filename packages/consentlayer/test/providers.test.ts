import { beforeEach, describe, expect, it, vi } from 'vitest'
import { googleConsentMode } from '../src/adapters/google-consent-mode'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { createAnalytics } from '../src/core/create-analytics'
import { loadScript } from '../src/core/plugin'
import { contentsquare } from '../src/providers/contentsquare'
import { ga4 } from '../src/providers/ga4'
import { gtm } from '../src/providers/gtm'
import { hotjar } from '../src/providers/hotjar'
import { meta } from '../src/providers/meta'
import { posthog } from '../src/providers/posthog'
import { sentry } from '../src/providers/sentry'
import { tiktok } from '../src/providers/tiktok'

describe('providers', () => {
  it('turns a provider off when its id is unset, but still rejects a malformed one', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    const skipped = [
      ga4({ measurementId: undefined }),
      gtm({ containerId: undefined }),
      meta({ pixelId: '' }),
      posthog({ apiKey: undefined }),
      sentry({ dsn: undefined }),
      contentsquare({ tagId: undefined }),
      hotjar({ siteId: '', version: 6 }),
    ]
    expect(skipped.map((plugin) => Object.keys(plugin))).toEqual(skipped.map(() => ['id', 'requiredConsent', 'setup']))

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
    expect(hotjar({ siteId: ' 123\n', version: '6' })).toHaveProperty('load', expect.any(Function))
    for (const siteId of ['1e3', '0x10', '12.0', '0']) {
      expect(() => hotjar({ siteId, version: 6 })).toThrow(/Hotjar siteId or version/)
    }
    expect(Object.keys(hotjar({ siteId: ' ', version: 6 }))).toEqual(['id', 'requiredConsent', 'setup'])
    expect(ga4({ measurementId: ' G-ABC123\n' })).toHaveProperty('load', expect.any(Function))
    expect(meta({ pixelId: '123456789012345\n' })).toHaveProperty('load', expect.any(Function))
    expect(Object.keys(posthog({ apiKey: ' ' }))).toEqual(['id', 'requiredConsent', 'setup'])
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

  it('posts the choice to the consent route once when the consent cookie is missing', async () => {
    const fetchMock = vi.fn<typeof fetch>((url) =>
      Promise.resolve(
        new Response(null, {
          status: 204,
          headers: url === '/api/analytics' ? { 'consentlayer-consent': 'missing' } : {},
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const consent = { preferences: false, analytics: true, marketing: false }
    const manager = createAnalyticsManager({
      consent,
      server: { endpoint: '/api/analytics', consentEndpoint: '/api/consent' },
    })
    await manager.boot()
    await manager.page()
    await manager.track('sign_up')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await new Promise((resolve) => setTimeout(resolve))
    vi.unstubAllGlobals()
    const restores = fetchMock.mock.calls.filter(([url]) => url === '/api/consent')
    expect(restores).toHaveLength(1)
    expect(JSON.parse(restores[0]?.[1]?.body as string)).toEqual({ consent, restored: true })
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
      log: () => undefined,
      emitError: () => undefined,
    })
    const bootstrap = (append.mock.calls[0]?.[0] as HTMLScriptElement).text
    append.mockRestore()
    expect(document.head.querySelector('[data-consentlayer="meta-pixel-bootstrap"]')).toBeNull()
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeGreaterThan(-1)
    expect(bootstrap.indexOf("fbq('consent', 'revoke')")).toBeLessThan(bootstrap.indexOf("fbq('init'"))
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

describe('ga4 consent mode', () => {
  const entries = () =>
    (window.dataLayer ?? []).map((entry) =>
      Array.from(entry as ArrayLike<unknown>).filter((arg) => !(arg instanceof Date)),
    )
  beforeEach(() => {
    const win = window as unknown as Record<string, unknown>
    for (const key of [
      'dataLayer',
      'gtag',
      '__consentlayerGa4Configured',
      '__consentlayerGoogleConsentMode',
      '__acmGoogleConsentMode',
      '__consentlayerBuiltInConsentMode',
      '__consentlayerGtmLoaded',
    ])
      delete win[key]
  })

  it('sets the Consent Mode defaults when the manager is created, before boot', async () => {
    const manager = createAnalyticsManager({ providers: [ga4({ measurementId: 'G-EARLY1' })] })
    expect(entries()[0]).toEqual(['consent', 'default', expect.objectContaining({ analytics_storage: 'denied' })])
    await manager.boot()
    expect(entries().filter(([command]) => command === 'consent')).toHaveLength(1)
    manager.destroy()

    window.dataLayer = []
    createAnalyticsManager({ providers: [ga4({ measurementId: 'G-EARLY1' })], enabled: false }).destroy()
    expect(entries()).toEqual([])
  })

  it('leaves Consent Mode to googleConsentMode() when it is an adapter, with region defaults until a choice', async () => {
    localStorage.clear()
    const analytics = createAnalytics({
      providers: [ga4({ measurementId: 'G-ADV123', consentMode: 'advanced' })],
      consent: {
        adapters: [
          googleConsentMode({
            regions: [{ region: ['US', 'US-CA'], analytics: true }],
            waitForUpdate: 500,
            urlPassthrough: true,
            adsDataRedaction: true,
          }),
        ],
      },
    })
    await analytics.boot()
    await analytics.identify('u1')
    await analytics.page({ path: '/a', url: 'https://example.com/a', title: 'A' })
    const denied = {
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      ad_storage: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      security_storage: 'granted',
    }
    expect(entries()).toEqual([
      ['consent', 'default', { ...denied, wait_for_update: 500 }],
      [
        'consent',
        'default',
        { ...denied, analytics_storage: 'granted', wait_for_update: 500, region: ['US', 'US-CA'] },
      ],
      ['set', 'url_passthrough', true],
      ['set', 'ads_data_redaction', true],
      ['js'],
      ['config', 'G-ADV123', { send_page_view: false }],
      ['set', { user_id: null }],
      ['set', 'user_data', {}],
      ['event', 'page_view', { page_location: 'https://example.com/a', page_path: '/a', page_title: 'A' }],
    ])
    expect(document.querySelector('script[src*="gtag/js?id=G-ADV123"]')).toBeTruthy()

    window.dataLayer = []
    await analytics.consent.setConsent({ preferences: false, analytics: true, marketing: false })
    expect(entries()).toEqual([
      ['consent', 'update', { ...denied, analytics_storage: 'granted' }],
      ['set', { user_id: 'u1' }],
      ['set', 'user_data', {}],
    ])
    analytics.destroy()
  })

  it('sends Consent Mode without GA4, rejects invalid settings and exports only the adapter', async () => {
    googleConsentMode().observe!({ preferences: true, analytics: false, marketing: true })
    expect(
      entries().map(([command, type, signals]) => [command, type, (signals as { ad_storage: string }).ad_storage]),
    ).toEqual([
      ['consent', 'default', 'denied'],
      ['consent', 'update', 'granted'],
    ])
    expect(() => googleConsentMode({ regions: [{ region: ['usa'] }] })).toThrow('ISO 3166-2')
    expect(() => googleConsentMode({ waitForUpdate: -1 })).toThrow('whole number')
    expect(Object.keys(await import('../src/adapters/google-consent-mode'))).toEqual(['googleConsentMode'])
  })

  it('gtm loads the container after the defaults and feeds dataLayer, sharing Consent Mode with ga4', async () => {
    localStorage.clear()
    const analytics = createAnalytics({
      providers: [
        ga4({ measurementId: 'G-GTM123', serverContainerUrl: 'https://sgtm.example.com' }),
        gtm({ containerId: 'GTM-ABC123', serverContainerUrl: 'https://sgtm.example.com/' }),
      ],
    })
    await analytics.boot()
    await analytics.identify('u1')
    await analytics.page({ path: '/a', url: 'https://example.com/a', title: 'A' })
    await analytics.track('sign_up', { method: 'email' }, { providers: { gtm: { plan: 'pro' } } })
    await analytics.consent.setConsent({ preferences: false, analytics: true, marketing: false })
    await new Promise((resolve) => setTimeout(resolve, 0))
    await analytics.reset()
    const log = (window.dataLayer ?? []).map((entry) =>
      Object.prototype.toString.call(entry) === '[object Arguments]'
        ? Array.from(entry as ArrayLike<unknown>).filter((arg) => !(arg instanceof Date))
        : { ...(entry as object), 'gtm.start': undefined },
    )
    const denied = {
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      ad_storage: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'denied',
      security_storage: 'granted',
    }
    expect(log).toEqual([
      ['consent', 'default', denied],
      ['js'],
      { event: 'gtm.js', 'gtm.start': undefined },
      {
        event: 'page_view',
        page_location: 'https://example.com/a',
        page_path: '/a',
        page_title: 'A',
        'gtm.start': undefined,
      },
      { event: 'sign_up', method: 'email', plan: 'pro', 'gtm.start': undefined },
      ['consent', 'update', { ...denied, analytics_storage: 'granted' }],
      ['config', 'G-GTM123', { send_page_view: false, server_container_url: 'https://sgtm.example.com' }],
      ['set', { user_id: 'u1' }],
      ['set', 'user_data', {}],
      {
        event: 'consentlayer_consent',
        consent: expect.objectContaining({ analytics: true, marketing: false }) as unknown,
        'gtm.start': undefined,
      },
      { event: 'consentlayer_identify', user_id: 'u1', 'gtm.start': undefined },
      ['set', { user_id: null }],
      ['set', 'user_data', {}],
      { event: 'consentlayer_identify', user_id: null, 'gtm.start': undefined },
    ])
    expect(document.querySelector('script[src="https://sgtm.example.com/gtm.js?id=GTM-ABC123"]')).toBeTruthy()
    analytics.destroy()
  })

  it('gtm waits for its requiredConsent and rejects a malformed container ID', async () => {
    const manager = createAnalyticsManager({
      providers: [gtm({ containerId: 'GTM-WAIT12', requiredConsent: 'analytics' })],
    })
    await manager.boot()
    expect(document.querySelector('script[src*="GTM-WAIT12"]')).toBeNull()
    await manager.updateConsent({ preferences: false, analytics: true, marketing: false })
    expect(document.querySelector('script[src="https://www.googletagmanager.com/gtm.js?id=GTM-WAIT12"]')).toBeTruthy()
    manager.destroy()
    expect(() => gtm({ containerId: 'G-ABC123' })).toThrow('Invalid GTM container ID')
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

describe('tiktok', () => {
  const denied = { preferences: false, analytics: false, marketing: false }
  const runBootstrap = () => {
    const win = window as unknown as Record<string, unknown>
    for (const key of ['ttq', 'TiktokAnalyticsObject', '__consentlayerTikTokPixelInitialized']) delete win[key]
    const append = document.head.appendChild.bind(document.head)
    return vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement && !node.src) window.eval(node.text)
      return append(node)
    })
  }
  const queued = () => Array.from(window.ttq as unknown as unknown[][])

  it('is off without a pixel id', () => {
    expect(Object.keys(tiktok({ pixelId: undefined }))).toEqual(['id', 'requiredConsent', 'setup'])
    expect(Object.keys(tiktok({ pixelId: ' ' }))).toEqual(['id', 'requiredConsent', 'setup'])
  })

  it('loads after consent, matches, tracks with the event id and stays off after a withdrawal', async () => {
    const append = runBootstrap()
    const manager = createAnalyticsManager({ providers: [tiktok({ pixelId: 'CABC123' })], consent: denied })
    await manager.boot()
    expect(window.ttq).toBeUndefined()
    expect(document.querySelector('script[src*="analytics.tiktok.com"]')).toBeNull()

    await manager.updateConsent({ ...denied, marketing: true })
    expect(
      document.querySelector('script[src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CABC123&lib=ttq"]'),
    ).not.toBeNull()
    expect((window.ttq as unknown as { _i: Record<string, unknown> })._i).toHaveProperty('CABC123')
    await manager.identify('u1', { email: ' Ada@Example.com', phone: '+1 213-373-4253' })
    await manager.page()
    await manager.track(
      'purchase',
      {
        transaction_id: 'o1',
        value: 10,
        currency: 'EUR',
        items: [{ item_id: 'sku', item_name: 'Mug', price: 5, quantity: 2 }],
      },
      { eventId: 'evt-1', providers: { tiktok: { description: 'mugs' } } },
    )
    await manager.track('share', {}, { eventId: 'evt-2' })
    await manager.updateConsent(denied)
    await manager.updateConsent({ ...denied, marketing: true })
    await manager.page()
    append.mockRestore()

    expect(queued()).toEqual([
      ['grantConsent'],
      ['identify', { email: 'ada@example.com', phone_number: '+12133734253', external_id: 'u1' }],
      ['page'],
      [
        'track',
        'Purchase',
        {
          value: 10,
          currency: 'EUR',
          order_id: 'o1',
          content_ids: ['sku'],
          contents: [{ content_id: 'sku', content_name: 'Mug', price: 5, quantity: 2 }],
          content_type: 'product',
          num_items: 2,
          description: 'mugs',
        },
        { event_id: 'evt-1' },
      ],
      ['track', 'share', {}, { event_id: 'evt-2' }],
      ['revokeConsent'],
      ['revokeConsent'],
    ])
    manager.destroy()
  })

  it('holds consent before ttq.load when it loads before consent', async () => {
    const append = runBootstrap()
    const manager = createAnalyticsManager({
      providers: [tiktok({ pixelId: 'CABC123', loadBeforeConsent: true })],
      consent: denied,
    })
    await manager.boot()
    const bootstrap = (append.mock.calls[0]?.[0] as HTMLScriptElement).text
    append.mockRestore()
    expect(bootstrap.indexOf('ttq.holdConsent()')).toBeGreaterThan(-1)
    expect(bootstrap.indexOf('ttq.holdConsent()')).toBeLessThan(bootstrap.indexOf('ttq.load("CABC123")'))
    expect(queued()).toEqual([['holdConsent']])
    manager.destroy()
  })
})

describe('withdrawal', () => {
  it('expires the cookies of ga4, meta and tiktok when their consent is withdrawn', async () => {
    const granted = { preferences: true, analytics: true, marketing: true }
    const manager = createAnalyticsManager({
      providers: [ga4({ measurementId: 'G-ABC123' }), meta({ pixelId: '12345678' }), tiktok({ pixelId: 'CABC123' })],
      consent: granted,
    })
    await manager.boot()
    const cookies = ['_ga', '_ga_ABC123', '_gid', '_fbp', '_fbc', '_ttp', 'ttclid', 'ttcsid', 'ttcsid_CABC123', 'keep']
    for (const name of cookies) document.cookie = `${name}=1; path=/`
    await manager.updateConsent({ ...granted, marketing: false })
    expect(document.cookie.split('; ').map((cookie) => cookie.split('=')[0])).toEqual([
      '_ga',
      '_ga_ABC123',
      '_gid',
      'keep',
    ])
    await manager.updateConsent({ ...granted, analytics: false, marketing: false })
    expect(document.cookie).toBe('keep=1')
    manager.destroy()
    document.cookie = 'keep=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('expires meta and tiktok cookies left from a visit before marketing was withdrawn', async () => {
    for (const name of ['_fbp', '_ttp']) document.cookie = `${name}=1; path=/`
    const manager = createAnalyticsManager({
      providers: [meta({ pixelId: '12345678' }), tiktok({ pixelId: 'CABC123' })],
      consent: { preferences: true, analytics: true, marketing: false },
    })
    await manager.boot()
    expect(document.cookie).toBe('')
    manager.destroy()
  })
})
