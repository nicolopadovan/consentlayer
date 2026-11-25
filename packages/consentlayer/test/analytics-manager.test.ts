import { autoTracking } from '../src/auto-tracking'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { createAnalytics, type AnalyticsOptions } from '../src/core/create-analytics'
import type { AnalyticsPlugin } from '../src/core/types'
import { ukStatisticsRegions } from '../src/core/regions'
import { createMemoryIdentityStorage } from '../src/core/storage'

describe('analytics manager', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('initializes and tears down providers based on consent', async () => {
    const analyticsProvider = {
      id: 'ga4',
      requiredConsent: 'analytics' as const,
      load: vi.fn(),
      teardown: vi.fn(),
      track: vi.fn(),
    }
    const marketingProvider = {
      id: 'meta',
      requiredConsent: 'marketing' as const,
      load: vi.fn(),
      teardown: vi.fn(),
      track: vi.fn(),
    }

    const manager = createAnalyticsManager({
      providers: [analyticsProvider, marketingProvider],
      identityStorage: createMemoryIdentityStorage(),
    })

    await manager.boot()
    await manager.updateConsent({
      preferences: true,
      analytics: true,
      marketing: false,
    })

    expect(analyticsProvider.load).toHaveBeenCalledTimes(1)
    expect(marketingProvider.load).not.toHaveBeenCalled()

    await manager.updateConsent({
      preferences: true,
      analytics: true,
      marketing: true,
    })

    expect(marketingProvider.load).toHaveBeenCalledTimes(1)

    await manager.updateConsent({
      preferences: true,
      analytics: false,
      marketing: false,
    })

    expect(analyticsProvider.teardown).toHaveBeenCalledTimes(1)
    expect(marketingProvider.teardown).toHaveBeenCalledTimes(1)
  })

  it('runs setup at creation, then consent and load at boot, and load only once', async () => {
    const calls: string[] = []
    const plugin = (id: string, loadBeforeConsent: boolean) => ({
      id,
      requiredConsent: 'analytics' as const,
      loadBeforeConsent,
      setup: () => void calls.push(`${id}.setup`),
      consent: () => void calls.push(`${id}.consent`),
      load: () => void calls.push(`${id}.load`),
      teardown: () => void calls.push(`${id}.teardown`),
    })
    const denied = { preferences: false, analytics: false, marketing: false }
    const manager = createAnalyticsManager({
      providers: [plugin('early', true), plugin('late', false)],
      consent: denied,
    })
    expect(calls).toEqual(['early.setup', 'late.setup'])
    calls.length = 0
    await manager.boot()
    expect(calls).toEqual(['early.consent', 'early.load', 'late.consent'])
    calls.length = 0
    await manager.updateConsent({ ...denied, analytics: true })
    await manager.updateConsent(denied)
    await manager.updateConsent({ ...denied, analytics: true })
    expect(calls.filter((call) => call.startsWith('late'))).toEqual([
      'late.consent',
      'late.load',
      'late.consent',
      'late.teardown',
      'late.consent',
    ])
  })

  it('enforces provider-level marketing gating for Meta dispatch', async () => {
    const analyticsTrack = vi.fn()
    const metaTrack = vi.fn()

    const manager = createAnalyticsManager({
      providers: [
        {
          id: 'ga4',
          requiredConsent: 'analytics',
          track: analyticsTrack,
        },
        {
          id: 'meta',
          requiredConsent: 'marketing',
          track: metaTrack,
        },
      ],
      identityStorage: createMemoryIdentityStorage(),
    })

    await manager.boot()
    await manager.updateConsent({
      preferences: true,
      analytics: true,
      marketing: false,
    })
    await manager.track('ProductViewed', {}, { only: ['meta', 'ga4'] })

    expect(analyticsTrack).toHaveBeenCalledTimes(1)
    expect(metaTrack).not.toHaveBeenCalled()
  })

  it('tracks delegated clicks, scroll depth, time buckets, and page session resets', async () => {
    vi.useFakeTimers()
    const trackedEvents: string[] = []
    const eventPayloads: Array<Record<string, unknown>> = []

    const manager = createAnalyticsManager({
      providers: [
        {
          id: 'ga4',
          requiredConsent: 'analytics',
          track: (event) => {
            trackedEvents.push(event.name)
            eventPayloads.push(event.params)
          },
        },
      ],
      identityStorage: createMemoryIdentityStorage(),
      autoTracking: autoTracking({ clicks: true, scroll: true, timeOnPage: true, pageViews: true }),
    })

    await manager.boot()
    await manager.updateConsent({
      preferences: true,
      analytics: true,
      marketing: false,
    })

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 200,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 100,
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 95,
    })

    const button = document.createElement('button')
    button.textContent = 'Checkout'
    document.body.appendChild(button)

    button.click()
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(5000)
    manager.newPageSession()
    await vi.runOnlyPendingTimersAsync()

    expect(trackedEvents).toContain('consentlayer.page_session_start')
    expect(trackedEvents).toContain('consentlayer.ui_click')
    expect(trackedEvents).toContain('consentlayer.scroll_depth')
    expect(trackedEvents).toContain('consentlayer.time_on_page')
    expect(trackedEvents.filter((eventName) => eventName === 'consentlayer.page_session_start').length).toBeGreaterThan(
      1,
    )
    expect(eventPayloads.find((payload) => payload.depth === 100)).toBeDefined()
  })

  it('holds calls until a deferred load runs, then delivers them in order', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const provider = {
      id: 'heavy',
      requiredConsent: 'none' as const,
      defer: 2000,
      load: () => {
        calls.push('load')
      },
      track: (event: { name: string }) => {
        calls.push(event.name)
      },
      error: (error: unknown) => {
        calls.push(String(error))
      },
    }
    const manager = createAnalyticsManager({
      providers: [provider],
      consent: { preferences: false, analytics: false, marketing: false },
    })
    await manager.boot()
    await manager.track('a')
    await manager.captureError('boom')
    expect(calls).toEqual([])
    await vi.advanceTimersByTimeAsync(2000)
    expect(calls).toEqual(['load', 'a', 'boom'])
    await manager.track('b')
    expect(calls).toEqual(['load', 'a', 'boom', 'b'])
    manager.destroy()
  })

  it('loads an interaction-deferred provider on the first interaction', async () => {
    const load = vi.fn()
    const manager = createAnalyticsManager({
      providers: [{ id: 'later', requiredConsent: 'none', defer: 'interaction', load }],
      consent: { preferences: false, analytics: false, marketing: false },
    })
    await manager.boot()
    await Promise.resolve()
    expect(load).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('keydown'))
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    manager.destroy()
  })

  it('never loads a deferred provider after destroy', async () => {
    const load = vi.fn()
    const manager = createAnalyticsManager({
      providers: [{ id: 'later', requiredConsent: 'none', defer: 'interaction', loadBeforeConsent: true, load }],
      consent: { preferences: false, analytics: false, marketing: false },
    })
    await manager.boot()
    manager.destroy()
    window.dispatchEvent(new Event('keydown'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(load).not.toHaveBeenCalled()
  })

  it('removes the interaction listeners of a pending deferred load on destroy', async () => {
    const added = vi.spyOn(window, 'addEventListener')
    const manager = createAnalyticsManager({
      providers: [{ id: 'later', requiredConsent: 'none', defer: 'interaction', load: vi.fn() }],
    })
    await manager.boot()
    manager.destroy()
    const interactions = added.mock.calls.filter(([type]) =>
      ['pointerdown', 'keydown', 'scroll', 'touchstart'].includes(type),
    )
    expect(interactions).toHaveLength(4)
    for (const [, , options] of interactions) expect((options as AddEventListenerOptions).signal?.aborted).toBe(true)
    added.mockRestore()
  })

  it('skips a deferred load when consent is withdrawn before it fires', async () => {
    vi.useFakeTimers()
    const load = vi.fn()
    const manager = createAnalyticsManager({
      providers: [{ id: 'gated', requiredConsent: 'analytics' as const, defer: 1000, load }],
      consent: { preferences: false, analytics: true, marketing: false },
    })
    await manager.boot()
    await manager.updateConsent({ preferences: false, analytics: false, marketing: false })
    await vi.advanceTimersByTimeAsync(1000)
    expect(load).not.toHaveBeenCalled()
    await manager.updateConsent({ preferences: false, analytics: true, marketing: false })
    await vi.advanceTimersByTimeAsync(1000)
    expect(load).toHaveBeenCalledTimes(1)
    manager.destroy()
  })

  it('sends caught and uncaught errors to providers with an error hook', async () => {
    const error = vi.fn()
    const manager = createAnalyticsManager({
      providers: [{ id: 'monitor', requiredConsent: 'none', error }],
      consent: { preferences: false, analytics: false, marketing: false },
    })
    await manager.boot()
    const failure = new Error('checkout')
    await manager.captureError(failure, { tags: { area: 'cart' } })
    await manager.captureError(failure)
    window.dispatchEvent(new ErrorEvent('error', { error: failure }))
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught') }))
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2))
    expect(error.mock.calls[0]?.slice(0, 2)).toEqual([failure, { source: 'manual', tags: { area: 'cart' } }])
    expect(error.mock.calls[1]?.[1]).toEqual({ source: 'global', level: 'fatal' })
    manager.destroy()
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('after destroy') }))
    await Promise.resolve()
    expect(error).toHaveBeenCalledTimes(2)
  })

  it('turns error capture off with errors: false, and only the handlers with globalHandlers: false', async () => {
    const off = vi.fn()
    const manual = vi.fn()
    const consent = { preferences: false, analytics: false, marketing: false }
    const a = createAnalyticsManager({
      providers: [{ id: 'a', requiredConsent: 'none', error: off }],
      consent,
      errors: false,
    })
    const b = createAnalyticsManager({
      providers: [{ id: 'b', requiredConsent: 'none', error: manual }],
      consent,
      errors: { globalHandlers: false },
    })
    await a.boot()
    await b.boot()
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('x') }))
    await a.captureError('y')
    await b.captureError('z')
    expect(off).not.toHaveBeenCalled()
    expect(manual).toHaveBeenCalledTimes(1)
    a.destroy()
    b.destroy()
  })

  it('reports a second provider with the same id and ignores it', async () => {
    const onError = vi.fn()
    const first = { id: 'ga4', requiredConsent: 'none' as const, track: vi.fn() }
    const second = { id: 'ga4', requiredConsent: 'none' as const, track: vi.fn() }
    const manager = createAnalyticsManager({ providers: [first, second, first], onError })
    await manager.boot()
    await manager.track('a')

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'provider-setup', providerId: 'ga4' }))
    expect(first.track).toHaveBeenCalledTimes(1)
    expect(second.track).not.toHaveBeenCalled()
  })

  it('reports once when calls before boot pass the queue limit', async () => {
    const onError = vi.fn()
    const provider = { id: 'p', requiredConsent: 'none' as const, track: vi.fn() }
    const manager = createAnalyticsManager({ providers: [provider], onError })
    for (let index = 0; index < 102; index += 1) void manager.track(`e${index}`)
    await manager.boot()

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'queue-full' }))
    expect(provider.track).toHaveBeenCalledTimes(100)
  })
})

describe('holdUntilChoice', () => {
  const granted = { preferences: true, analytics: true, marketing: true }
  const spy = (id: string, requiredConsent: 'analytics' | 'marketing' | 'none') =>
    ({
      id,
      requiredConsent,
      page: vi.fn<NonNullable<AnalyticsPlugin['page']>>(),
      track: vi.fn<NonNullable<AnalyticsPlugin['track']>>(),
    }) satisfies AnalyticsPlugin
  const names = (plugin: ReturnType<typeof spy>) => plugin.track.mock.calls.map(([event]) => event.name)
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  const choose = async (analytics: ReturnType<typeof createAnalytics>, consent: typeof granted) => {
    await analytics.consent.update(consent)
    await settle()
  }

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  const landed = async (options: Partial<AnalyticsOptions> = {}) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const stats = spy('stats', 'analytics')
    const ads = spy('ads', 'marketing')
    const analytics = createAnalytics({
      providers: [stats, ads],
      consent: { region: 'CH' },
      server: { endpoint: '/api/analytics' },
      ...options,
    })
    await analytics.consent.bootstrap()
    await analytics.boot()
    await analytics.page()
    await analytics.track('view_item', { item_id: 'sku-1' })
    const forwarded = () =>
      fetchMock.mock.calls
        .filter(([input]) => input === '/api/analytics')
        .map(([, init]) => {
          const { name, categories } = JSON.parse(init?.body as string) as { name: string; categories?: string[] }
          return categories ? `${name} to ${categories.join()}` : name
        })
    return { analytics, stats, ads, forwarded }
  }

  it('delivers events made while the banner asks to what the choice allows, once each', async () => {
    const { analytics, stats, ads, forwarded } = await landed({ holdUntilChoice: true })
    expect([names(stats), names(ads), stats.page.mock.calls.length]).toEqual([['view_item'], [], 1])
    expect(forwarded()).toEqual(['page_view', 'view_item'])
    await choose(analytics, granted)
    expect([names(stats), names(ads)]).toEqual([['view_item'], ['view_item']])
    expect([stats.page.mock.calls.length, ads.page.mock.calls.length]).toEqual([1, 1])
    expect(ads.track.mock.calls[0]?.[0].params).toEqual({ item_id: 'sku-1' })
    expect(forwarded()).toEqual(['page_view', 'view_item', 'page_view to marketing', 'view_item to marketing'])
    await analytics.track('view_item')
    expect(names(ads)).toEqual(['view_item', 'view_item'])
    expect(forwarded().slice(4)).toEqual(['view_item'])
    analytics.destroy()
  })

  it('drops held events the choice does not allow, and holds nothing without the option', async () => {
    const declined = await landed({ holdUntilChoice: true })
    await choose(declined.analytics, { preferences: false, analytics: true, marketing: false })
    await choose(declined.analytics, granted)
    expect(names(declined.ads)).toEqual([])
    expect(declined.forwarded()).toEqual(['page_view', 'view_item'])
    declined.analytics.destroy()
    localStorage.clear()
    vi.restoreAllMocks()

    const off = await landed()
    await choose(off.analytics, granted)
    expect([names(off.ads), off.ads.page.mock.calls.length]).toEqual([[], 0])
    expect(off.forwarded()).toEqual(['page_view', 'view_item'])
    off.analytics.destroy()
  })

  it('forwards held events for every category the choice adds, after the consent endpoint records it', async () => {
    const { analytics, forwarded } = await landed({
      holdUntilChoice: true,
      consent: { region: 'GB', regions: ukStatisticsRegions },
      server: { endpoint: '/api/analytics', consentEndpoint: '/api/consent' },
    })
    const fetchMock = vi.mocked(fetch)
    let recorded = () => {}
    fetchMock.mockImplementation((input) =>
      input === '/api/consent'
        ? new Promise((resolve) => (recorded = () => resolve(new Response(null, { status: 204 }))))
        : Promise.resolve(new Response(null, { status: 204 })),
    )
    const choice = choose(analytics, granted)
    await settle()
    expect(forwarded()).toEqual(['page_view', 'view_item'])
    recorded()
    await choice
    expect(forwarded()).toEqual([
      'page_view',
      'view_item',
      'page_view to preferences,marketing',
      'view_item to preferences,marketing',
    ])
    analytics.destroy()
  })

  it('forwards held events to the server once the choice allows it', async () => {
    const { analytics, forwarded } = await landed({ holdUntilChoice: true, consent: { region: 'DE' } })
    expect(forwarded()).toEqual([])
    await choose(analytics, { preferences: false, analytics: false, marketing: true })
    expect(forwarded()).toEqual(['page_view', 'view_item'])
    analytics.destroy()
  })
})
