import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { createMemoryIdentityStorage } from '../src/core/storage'

type CollectedEvent = { name: string; params: Record<string, unknown> }

function setupManager(collected: CollectedEvent[]) {
  return createAnalyticsManager({
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
    const manager = setupManager(events)
    await boot(manager)

    const button = document.createElement('button')
    button.textContent = 'Buy'
    document.body.appendChild(button)

    manager.enableAutoTracking({ clicks: false })
    button.click()

    expect(events.find((e) => e.name === 'consentlayer.ui_click')).toBeUndefined()
  })

  it('attribute mode only fires for elements bearing the attribute', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
    await boot(manager)

    const tracked = document.createElement('button')
    tracked.setAttribute('data-track', 'checkout')
    document.body.appendChild(tracked)

    const ignored = document.createElement('button')
    ignored.textContent = 'random'
    document.body.appendChild(ignored)

    manager.enableAutoTracking({ clicks: { mode: 'attribute' } })
    ignored.click()
    tracked.click()

    const clickEvents = events.filter((e) => e.name === 'consentlayer.ui_click')
    expect(clickEvents).toHaveLength(1)
    expect(clickEvents[0]?.params.ui_target).toBe('checkout')
  })

  it('honors a custom attribute name in attribute mode', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
    await boot(manager)

    const tracked = document.createElement('div')
    tracked.setAttribute('data-analytics', 'hero-cta')
    document.body.appendChild(tracked)

    manager.enableAutoTracking({
      clicks: { mode: 'attribute', attribute: 'data-analytics' },
    })
    tracked.click()

    const clickEvents = events.filter((e) => e.name === 'consentlayer.ui_click')
    expect(clickEvents).toHaveLength(1)
    expect(clickEvents[0]?.params.ui_target).toBe('hero-cta')
  })

  it('fires scroll depth only at configured thresholds', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
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

    manager.enableAutoTracking({ scroll: { thresholds: [50] } })
    window.dispatchEvent(new Event('scroll'))

    const scrollEvents = events.filter((e) => e.name === 'consentlayer.scroll_depth')
    expect(scrollEvents).toHaveLength(1)
    expect(scrollEvents[0]?.params.depth).toBe(50)
  })

  it('fires time-on-page only at configured intervals', async () => {
    vi.useFakeTimers()
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
    await boot(manager)

    manager.enableAutoTracking({ timeOnPage: { intervals: [10, 60] } })

    await vi.advanceTimersByTimeAsync(10000)
    expect(events.filter((e) => e.name === 'consentlayer.time_on_page').map((e) => e.params.seconds)).toEqual([10])

    await vi.advanceTimersByTimeAsync(50000)
    expect(events.filter((e) => e.name === 'consentlayer.time_on_page').map((e) => e.params.seconds)).toEqual([10, 60])
  })

  it('suppresses page_session_start when pageViews is false', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
    await boot(manager)

    manager.enableAutoTracking({ pageViews: false })

    expect(events.find((e) => e.name === 'consentlayer.page_session_start')).toBeUndefined()
  })

  it('turns on only the kinds an object names, else every kind it does not turn off', async () => {
    const sessionStarts = async (config: Parameters<ReturnType<typeof setupManager>['enableAutoTracking']>[0]) => {
      const events: CollectedEvent[] = []
      const manager = setupManager(events)
      await boot(manager)
      manager.enableAutoTracking(config)
      return events.filter((e) => e.name === 'consentlayer.page_session_start').length
    }
    expect(await sessionStarts({ clicks: { mode: 'attribute' } })).toBe(0)
    expect(await sessionStarts({ scroll: true, pageViews: true })).toBe(1)
    expect(await sessionStarts({ scroll: false })).toBe(1)
    expect(await sessionStarts({ only: ['collector'] })).toBe(1)
  })

  it('preserves current behaviour when called with no config', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
    await boot(manager)

    const button = document.createElement('button')
    button.textContent = 'Click me'
    document.body.appendChild(button)

    manager.enableAutoTracking()
    button.click()

    expect(events.find((e) => e.name === 'consentlayer.page_session_start')).toBeDefined()
    expect(events.find((e) => e.name === 'consentlayer.ui_click')).toBeDefined()
  })
})
