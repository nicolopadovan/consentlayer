import { beforeEach, describe, expect, it, vi } from 'vitest'
import { autoTracking } from '../src/auto-tracking'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import type { AutoTrackingConfig } from '../src/core/types'
import { createMemoryIdentityStorage } from '../src/core/storage'

type CollectedEvent = { name: string; params: Record<string, unknown> }

function setupManager(collected: CollectedEvent[], config?: AutoTrackingConfig) {
  return createAnalyticsManager({
    autoTracking: autoTracking(config),
    providers: [
      {
        id: 'collector',
        requiredConsent: 'analytics',
        track: (event) => {
          collected.push({ name: event.name, params: event.params })
        },
      },
    ],
    identityStorage: createMemoryIdentityStorage(),
  })
}

async function boot(manager: ReturnType<typeof setupManager>) {
  await manager.boot()
  await manager.updateConsent({
    preferences: true,
    analytics: true,
    marketing: true,
  })
}

describe('granular auto-tracking', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    vi.useRealTimers()
  })

  it('disables clicks entirely when clicks: false', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events, { clicks: false })
    await boot(manager)

    const button = document.createElement('button')
    button.textContent = 'Buy'
    document.body.appendChild(button)
    button.click()

    expect(events.find((e) => e.name === 'consentlayer.ui_click')).toBeUndefined()
  })

  it('attribute mode only fires for elements bearing the attribute', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events, { clicks: { mode: 'attribute' } })
    await boot(manager)

    const tracked = document.createElement('button')
    tracked.setAttribute('data-track', 'checkout')
    document.body.appendChild(tracked)

    const ignored = document.createElement('button')
    ignored.textContent = 'random'
    document.body.appendChild(ignored)
    ignored.click()
    tracked.click()

    const clickEvents = events.filter((e) => e.name === 'consentlayer.ui_click')
    expect(clickEvents).toHaveLength(1)
    expect(clickEvents[0]?.params.ui_target).toBe('checkout')
  })

  it('labels a click only from the tracking attribute or aria-label, never from page text', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events, { clicks: true })
    await boot(manager)

    const labels = [['aria-label', 'Close'], ['name', 'email'], []].map((attributes) => {
      const button = document.createElement('button')
      const [name, value] = attributes
      if (name && value) button.setAttribute(name, value)
      button.textContent = 'jane@example.com'
      document.body.appendChild(button)
      return button
    })
    labels.forEach((button) => button.click())

    const clickEvents = events.filter((e) => e.name === 'consentlayer.ui_click')
    expect(clickEvents.map((e) => e.params.ui_target)).toEqual(['Close', 'unknown', 'unknown'])
    labels.forEach((button) => button.remove())
  })

  it('honors a custom attribute name in attribute mode', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events, {
      clicks: { mode: 'attribute', attribute: 'data-analytics' },
    })
    await boot(manager)

    const tracked = document.createElement('div')
    tracked.setAttribute('data-analytics', 'hero-cta')
    document.body.appendChild(tracked)
    tracked.click()

    const clickEvents = events.filter((e) => e.name === 'consentlayer.ui_click')
    expect(clickEvents).toHaveLength(1)
    expect(clickEvents[0]?.params.ui_target).toBe('hero-cta')
  })

  it('fires scroll depth only at configured thresholds', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events, { scroll: { thresholds: [50] } })
    await boot(manager)

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 1000,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 500,
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 250,
    })
    window.dispatchEvent(new Event('scroll'))

    const scrollEvents = events.filter((e) => e.name === 'consentlayer.scroll_depth')
    expect(scrollEvents).toHaveLength(1)
    expect(scrollEvents[0]?.params.depth).toBe(50)
  })

  it('fires time-on-page only at configured intervals', async () => {
    vi.useFakeTimers()
    const events: CollectedEvent[] = []
    const manager = setupManager(events, { timeOnPage: { intervals: [10, 60] } })
    await boot(manager)

    await vi.advanceTimersByTimeAsync(10000)
    expect(events.filter((e) => e.name === 'consentlayer.time_on_page').map((e) => e.params.seconds)).toEqual([10])

    await vi.advanceTimersByTimeAsync(50000)
    expect(events.filter((e) => e.name === 'consentlayer.time_on_page').map((e) => e.params.seconds)).toEqual([10, 60])
  })

  it('suppresses page_session_start when pageViews is false', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events, { pageViews: false })
    await boot(manager)

    expect(events.find((e) => e.name === 'consentlayer.page_session_start')).toBeUndefined()
  })

  it('turns on only the kinds an object names, else every kind it does not turn off', async () => {
    const sessionStarts = async (config: AutoTrackingConfig) => {
      const events: CollectedEvent[] = []
      const manager = setupManager(events, config)
      await boot(manager)
      return events.filter((e) => e.name === 'consentlayer.page_session_start').length
    }
    expect(await sessionStarts({ clicks: { mode: 'attribute' } })).toBe(0)
    expect(await sessionStarts({ scroll: true, pageViews: true })).toBe(1)
    expect(await sessionStarts({ scroll: false })).toBe(1)
  })

  it('removes its listeners and timers when the signal aborts, and restarts them per page session', async () => {
    vi.useFakeTimers()
    const track = vi.fn<(name: string, params: object, options: object) => Promise<void>>(() => Promise.resolve())
    const lifetime = new AbortController()
    const startPage = autoTracking({ timeOnPage: { intervals: [10] }, clicks: true })({
      track,
      signal: lifetime.signal,
    })
    startPage()
    await vi.advanceTimersByTimeAsync(5000)
    startPage()
    await vi.advanceTimersByTimeAsync(10000)
    expect(track.mock.calls.map(([name]) => name)).toEqual(['consentlayer.time_on_page'])
    expect(track).toHaveBeenCalledWith('consentlayer.time_on_page', { seconds: 10, session_id: 2 }, expect.anything())

    lifetime.abort()
    document.body.appendChild(document.createElement('button')).click()
    await vi.advanceTimersByTimeAsync(10000)
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('preserves current behaviour when called with no config', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
    await boot(manager)

    const button = document.createElement('button')
    button.textContent = 'Click me'
    document.body.appendChild(button)
    button.click()

    expect(events.find((e) => e.name === 'consentlayer.page_session_start')).toBeDefined()
    expect(events.find((e) => e.name === 'consentlayer.ui_click')).toBeDefined()
  })
})

describe('autoTracking failures', () => {
  it('rejects a value that is not autoTracking()', () => {
    // @ts-expect-error the v0 boolean form
    expect(() => createAnalyticsManager({ autoTracking: true })).toThrow(/autoTracking/)
  })

  it('keeps applying consent when autoTracking throws', async () => {
    const onError = vi.fn()
    const manager = createAnalyticsManager({
      autoTracking: () => {
        throw new Error('boom')
      },
      providers: [{ id: 'p', requiredConsent: 'analytics' }],
      identityStorage: createMemoryIdentityStorage(),
      onError,
    })
    await manager.boot()
    await manager.updateConsent({ preferences: true, analytics: true, marketing: true })
    await manager.updateConsent({ preferences: true, analytics: false, marketing: false })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'auto-tracking' }))
    expect(manager.getSnapshot().activeProviders).toEqual([])
  })
})
