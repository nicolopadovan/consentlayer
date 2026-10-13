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

    expect(trackedEvents).toContain('npcm.page_session_start')
    expect(trackedEvents).toContain('npcm.ui_click')
    expect(trackedEvents).toContain('npcm.scroll_depth')
    expect(trackedEvents).toContain('npcm.time_on_page')
    expect(
      trackedEvents.filter(
        (eventName) => eventName === 'npcm.page_session_start',
      )
        .length,
    ).toBeGreaterThan(1)
    expect(
      eventPayloads.find((payload) => payload.depth === 100),
    ).toBeDefined()
  })
})
