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

  it('sends page_session_start only when pageViews is true', async () => {
    const events: CollectedEvent[] = []
    await boot(setupManager(events))
    expect(events.find((e) => e.name === 'consentlayer.page_session_start')).toBeUndefined()
    await boot(setupManager(events, { clicks: true, pageViews: true }))
    expect(events.find((e) => e.name === 'consentlayer.page_session_start')).toBeDefined()
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
    expect(await sessionStarts({ scroll: false })).toBe(0)
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
    expect(track).toHaveBeenCalledWith(
      'consentlayer.time_on_page',
      { seconds: 10, page_index: 2, session_id: 2 },
      expect.anything(),
    )

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

    expect(events.find((e) => e.name === 'consentlayer.ui_click')).toBeDefined()
  })
})

describe('enhanced measurement auto-tracking', () => {
  const names = (events: CollectedEvent[]) => events.map((e) => e.name)
  const link = (href: string) => {
    const a = document.body.appendChild(document.createElement('a'))
    a.href = href
    a.addEventListener('click', (event) => event.preventDefault())
    return a
  }

  beforeEach(() => {
    document.body.replaceChildren()
    window.history.replaceState(null, '', '/')
  })

  it('sends nothing before analytics consent', async () => {
    const events: CollectedEvent[] = []
    const manager = setupManager(events)
    await manager.boot()
    await manager.updateConsent({ preferences: true, analytics: false, marketing: true })
    link('https://other.example/report.pdf').click()
    expect(events).toEqual([])
  })

  it('tracks outbound links and downloads, but not internal pages', async () => {
    const events: CollectedEvent[] = []
    await boot(setupManager(events, { outboundClicks: true, downloads: true }))
    link('/about').click()
    link('/files/Report.PDF').click()
    link('https://other.example/page').click()
    expect(events).toEqual([
      {
        name: 'consentlayer.file_download',
        params: {
          link_url: `${window.location.origin}/files/Report.PDF`,
          link_id: undefined,
          file_name: '/files/Report.PDF',
          file_extension: 'pdf',
          page_index: 1,
          session_id: 1,
        },
      },
      {
        name: 'consentlayer.outbound_click',
        params: {
          link_url: 'https://other.example/page',
          link_id: undefined,
          link_domain: 'other.example',
          page_index: 1,
          session_id: 1,
        },
      },
    ])
  })

  it('sends ui_click for a link only when no outbound or download event covers it, or it has the attribute', async () => {
    const events: CollectedEvent[] = []
    await boot(setupManager(events, { clicks: true, outboundClicks: true, downloads: true }))
    link('/about').click()
    link('/files/report.pdf').click()
    link('https://other.example/page').click()
    const tagged = link('https://other.example/docs')
    tagged.setAttribute('data-track', 'docs')
    tagged.click()
    expect(events.map((e) => [e.name, e.params.ui_target])).toEqual([
      ['consentlayer.ui_click', 'unknown'],
      ['consentlayer.file_download', undefined],
      ['consentlayer.outbound_click', undefined],
      ['consentlayer.ui_click', 'docs'],
      ['consentlayer.outbound_click', undefined],
    ])
  })

  it('uses the configured download extensions', async () => {
    const events: CollectedEvent[] = []
    await boot(setupManager(events, { downloads: { extensions: ['dmg'] } }))
    link('/a.pdf').click()
    link('/a.dmg').click()
    expect(events.map((e) => e.params.file_extension)).toEqual(['dmg'])
  })

  it('sends the site search term from the URL', async () => {
    window.history.replaceState(null, '', '/search?query=red+shoes')
    const events: CollectedEvent[] = []
    await boot(setupManager(events, { siteSearch: true }))
    expect(events).toEqual([
      { name: 'consentlayer.site_search', params: { search_term: 'red shoes', page_index: 1, session_id: 1 } },
    ])
  })

  it('sends form_start once per form and form_submit on each submit, without field values', async () => {
    const events: CollectedEvent[] = []
    await boot(setupManager(events, { forms: true }))
    const form = document.body.appendChild(document.createElement('form'))
    form.id = 'contact'
    form.setAttribute('action', '/send')
    const input = form.appendChild(document.createElement('input'))
    input.name = 'id'
    input.value = 'jane@example.com'
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true }))
    const params = {
      form_id: 'contact',
      form_name: undefined,
      form_destination: `${window.location.origin}/send`,
      page_index: 1,
      session_id: 1,
    }
    expect(events).toEqual([
      { name: 'consentlayer.form_start', params },
      { name: 'consentlayer.form_submit', params },
    ])
  })

  it('tracks a video element from start to completion', async () => {
    const events: CollectedEvent[] = []
    await boot(setupManager(events, { video: true }))
    const video = document.body.appendChild(document.createElement('video'))
    video.title = 'Intro'
    const at = (currentTime: number, type: string) => {
      Object.defineProperties(video, {
        currentTime: { configurable: true, value: currentTime },
        duration: { configurable: true, value: 100 },
        paused: { configurable: true, value: false },
      })
      video.dispatchEvent(new Event(type))
    }
    at(0, 'play')
    at(30, 'timeupdate')
    at(30, 'timeupdate')
    at(100, 'ended')
    expect(names(events)).toEqual([
      'consentlayer.video_start',
      'consentlayer.video_progress',
      'consentlayer.video_progress',
      'consentlayer.video_progress',
      'consentlayer.video_progress',
      'consentlayer.video_complete',
    ])
    expect(events.filter((e) => e.name === 'consentlayer.video_progress').map((e) => e.params.video_percent)).toEqual([
      10, 25, 50, 75,
    ])
    expect(events[0]?.params).toMatchObject({ video_provider: 'html5', video_title: 'Intro', video_duration: 100 })
  })

  it('tracks a YouTube embed with enablejsapi=1 from its messages', async () => {
    const events: CollectedEvent[] = []
    const frame = document.body.appendChild(document.createElement('iframe'))
    frame.src = 'https://www.youtube.com/embed/abc?enablejsapi=1'
    const post = vi.spyOn(frame.contentWindow!, 'postMessage')
    await boot(setupManager(events, { video: true }))
    expect(post).toHaveBeenCalledWith(JSON.stringify({ event: 'listening', channel: 'widget' }), '*')
    const deliver = (origin: string, info: object) =>
      window.dispatchEvent(
        new MessageEvent('message', {
          origin,
          source: frame.contentWindow,
          data: JSON.stringify({ event: 'infoDelivery', info }),
        }),
      )
    deliver('https://evil.example', { playerState: 1, duration: 60 })
    deliver('https://www.youtube.com', { playerState: 1, currentTime: 0, duration: 60, videoData: { title: 'Demo' } })
    deliver('https://www.youtube.com', { playerState: 0, currentTime: 60 })
    expect(names(events)).toEqual([
      'consentlayer.video_start',
      'consentlayer.video_progress',
      'consentlayer.video_progress',
      'consentlayer.video_progress',
      'consentlayer.video_progress',
      'consentlayer.video_complete',
    ])
    expect(events[0]?.params).toMatchObject({ video_provider: 'youtube', video_title: 'Demo', video_duration: 60 })
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
