import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
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

  it('runs setup, consent and load in order, and load only once', async () => {
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
    await manager.boot()
    expect(calls).toEqual(['early.setup', 'early.consent', 'early.load', 'late.setup', 'late.consent'])
    calls.length = 0
    await manager.updateConsent({ ...denied, analytics: true })
    await manager.updateConsent(denied)
    await manager.updateConsent({ ...denied, analytics: true })
    expect(calls.filter((call) => call.startsWith('late'))).toEqual([
      'late.consent', 'late.load', 'late.consent', 'late.teardown', 'late.consent',
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

    manager.enableAutoTracking()
    button.click()
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(5000)
    manager.newPageSession()
    await vi.runOnlyPendingTimersAsync()

    expect(trackedEvents).toContain('consentlayer.page_session_start')
    expect(trackedEvents).toContain('consentlayer.ui_click')
    expect(trackedEvents).toContain('consentlayer.scroll_depth')
    expect(trackedEvents).toContain('consentlayer.time_on_page')
    expect(
      trackedEvents.filter(
        (eventName) => eventName === 'consentlayer.page_session_start',
      )
        .length,
    ).toBeGreaterThan(1)
    expect(
      eventPayloads.find((payload) => payload.depth === 100),
    ).toBeDefined()
  })

  it('holds calls until a deferred load runs, then delivers them in order', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const provider = {
      id: 'heavy',
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
      providers: [{ id: 'later', defer: 'interaction', load }],
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
      providers: [{ id: 'later', defer: 'interaction', loadBeforeConsent: true, load }],
      consent: { preferences: false, analytics: false, marketing: false },
    })
    await manager.boot()
    manager.destroy()
    window.dispatchEvent(new Event('keydown'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(load).not.toHaveBeenCalled()
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
      providers: [{ id: 'monitor', error }],
      consent: { preferences: false, analytics: false, marketing: false },
    })
    await manager.boot()
    const failure = new Error('checkout')
    await manager.captureError(failure, { tags: { area: 'cart' } })
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
    const a = createAnalyticsManager({ providers: [{ id: 'a', error: off }], consent, errors: false })
    const b = createAnalyticsManager({
      providers: [{ id: 'b', error: manual }],
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
})
