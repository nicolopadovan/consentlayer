import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import type { AnalyticsPlugin, ConsentState } from '../src/core/types'
import { posthog } from '../src/providers/posthog'
import { sentry } from '../src/providers/sentry'
import { checkPlugin } from '../src/testing'

const ph = vi.hoisted(() => {
  let opted: 'in' | 'out' | undefined
  return {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    group: vi.fn(),
    reset: vi.fn(() => (opted = undefined)),
    captureException: vi.fn(),
    startSessionRecording: vi.fn(),
    opt_in_capturing: vi.fn(() => (opted = 'in')),
    opt_out_capturing: vi.fn(() => (opted = 'out')),
    has_opted_in_capturing: () => opted === 'in',
    has_opted_out_capturing: () => opted === 'out',
    clear: () => (opted = undefined),
  }
})
const recorderLoaded = vi.hoisted(() => vi.fn())
const sdk = vi.hoisted(() => {
  const replay = { name: 'Replay', stop: vi.fn(() => Promise.resolve()), startBuffering: vi.fn() }
  return {
    replay,
    init: vi.fn(),
    setUser: vi.fn(),
    captureException: vi.fn(),
    addIntegration: vi.fn(),
    replayIntegration: vi.fn(() => replay),
    browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
  }
})

vi.mock('posthog-js', () => ({ default: ph }))
vi.mock('posthog-js/dist/posthog-recorder', () => ({}))
vi.mock('@sentry/browser', () => sdk)

const denied: ConsentState = { preferences: false, analytics: false, marketing: false }
const granted: ConsentState = { preferences: true, analytics: true, marketing: true }

const start = async (plugin: AnalyticsPlugin, consent = denied) => {
  const manager = createAnalyticsManager({ providers: [plugin], consent })
  await manager.boot()
  return manager
}

beforeEach(() => {
  vi.clearAllMocks()
  ph.clear()
})

describe('posthog', () => {
  it('passes the plugin contract', async () => {
    expect(await checkPlugin(posthog({ apiKey: 'phc_test' }))).toEqual([])
    expect(await checkPlugin(posthog({ apiKey: 'phc_test', cookieless: false, recording: true }))).toEqual([])
  })

  it('counts cookieless before consent and switches to cookies once analytics is granted', async () => {
    const manager = await start(posthog({ apiKey: 'phc_test' }))
    expect(ph.init.mock.calls[0]?.[1]).toMatchObject({
      cookieless_mode: 'on_reject',
      autocapture: false,
      disable_session_recording: true,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
    })
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1)

    await manager.track('sign_up', { method: 'google' })
    await manager.identify('user_1')
    expect(ph.capture).toHaveBeenCalledWith('sign_up', { method: 'google' })
    expect(ph.identify).not.toHaveBeenCalled()

    await manager.updateConsent(granted)
    expect(ph.opt_in_capturing).toHaveBeenCalledTimes(1)
    expect(ph.identify).toHaveBeenCalledWith('user_1')

    await manager.updateConsent(denied)
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(2)
    expect(ph.startSessionRecording).not.toHaveBeenCalled()
  })

  it('loads the recorder only with recording on and analytics granted', async () => {
    vi.resetModules()
    vi.doMock('posthog-js/dist/posthog-recorder', () => {
      recorderLoaded()
      return {}
    })
    const fresh = await import('../src/providers/posthog')
    const manager = await start(fresh.posthog({ apiKey: 'phc_test', recording: true }))
    expect(ph.init.mock.calls[0]?.[1]).toMatchObject({
      advanced_disable_flags: false,
      advanced_disable_feature_flags: true,
    })
    expect(recorderLoaded).not.toHaveBeenCalled()
    await manager.updateConsent(granted)
    expect(recorderLoaded).toHaveBeenCalledTimes(1)
    expect(ph.startSessionRecording).toHaveBeenCalled()
  })

  it('redacts the URLs PostHog reads itself, but not $set traits or replay snapshots', async () => {
    const manager = await start(posthog({ apiKey: 'phc_test' }))
    const beforeSend = (ph.init.mock.calls[0]?.[1] as { before_send: (event: unknown) => unknown }).before_send
    const url = 'https://a.com/?email=jane%40example.com'
    expect(
      beforeSend({
        event: '$pageview',
        properties: { $current_url: url, $referrer: url, n: 1 },
        $set: { email: 'jane@example.com' },
        $set_once: { $initial_current_url: url },
      }),
    ).toEqual({
      event: '$pageview',
      properties: {
        $current_url: 'https://a.com/?email=(redacted)',
        $referrer: 'https://a.com/?email=(redacted)',
        n: 1,
      },
      $set: { email: 'jane@example.com' },
      $set_once: { $initial_current_url: 'https://a.com/?email=(redacted)' },
    })
    const snapshot = { event: '$snapshot', properties: { url } }
    expect(beforeSend(snapshot)).toBe(snapshot)
    expect(beforeSend(null)).toBeNull()
    manager.destroy()
  })

  it('loads nothing before consent with cookieless off', async () => {
    const manager = await start(posthog({ apiKey: 'phc_test', cookieless: false }))
    expect(ph.init).not.toHaveBeenCalled()
    await manager.updateConsent(granted)
    expect(ph.init.mock.calls[0]?.[1]).toMatchObject({ cookieless_mode: undefined })
    expect(ph.opt_in_capturing).toHaveBeenCalled()
  })

  it('opts back in after reset and sends errors', async () => {
    const manager = await start(posthog({ apiKey: 'phc_test' }), granted)
    await manager.reset()
    expect(ph.reset).toHaveBeenCalled()
    expect(ph.opt_in_capturing).toHaveBeenCalledTimes(2)

    const error = new Error('boom')
    await manager.captureError(error, { tags: { area: 'cart' } })
    expect(ph.captureException).toHaveBeenCalledWith(error, { level: undefined, area: 'cart' })
  })
})

describe('sentry', () => {
  it('passes the plugin contract', async () => {
    expect(await checkPlugin(sentry({ dsn: 'https://k@o1.ingest.sentry.io/1', replay: true, tracing: true }))).toEqual(
      [],
    )
  })

  it('reports errors without personal data before consent', async () => {
    const manager = await start(sentry({ dsn: 'https://k@o1.ingest.sentry.io/1', replay: true, tracing: true }))
    const options = sdk.init.mock.calls[0]?.[0] as {
      dataCollection: unknown
      integrations: (defaults: { name: string }[]) => { name: string }[]
      beforeSendTransaction: (event: object) => object | null
    }
    expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false })
    expect(options.integrations([{ name: 'GlobalHandlers' }, { name: 'Dedupe' }])).toEqual([{ name: 'Dedupe' }])
    expect(options.beforeSendTransaction({})).toBeNull()

    await manager.identify('user_1')
    expect(sdk.setUser).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'user_1' }))
    expect(sdk.replayIntegration).not.toHaveBeenCalled()
    expect(sdk.browserTracingIntegration).not.toHaveBeenCalled()

    const error = new Error('boom')
    await manager.captureError(error, { level: 'warning' })
    expect(sdk.captureException).toHaveBeenCalledWith(error, {
      level: 'warning',
      tags: { source: 'manual' },
      extra: undefined,
    })
  })

  it('adds the user, Replay and tracing on analytics consent and stops Replay on withdrawal', async () => {
    const manager = await start(sentry({ dsn: 'https://k@o1.ingest.sentry.io/1', replay: true, tracing: true }))
    await manager.identify('user_1')
    await manager.updateConsent(granted)
    expect(sdk.setUser).toHaveBeenLastCalledWith({ id: 'user_1', email: undefined })
    expect(sdk.addIntegration).toHaveBeenCalledTimes(2)

    await manager.updateConsent(denied)
    expect(sdk.replay.stop).toHaveBeenCalled()
    expect(sdk.setUser).toHaveBeenLastCalledWith(null)

    await manager.updateConsent(granted)
    expect(sdk.replay.startBuffering).toHaveBeenCalled()
    expect(sdk.addIntegration).toHaveBeenCalledTimes(2)
  })

  it('never loads Replay or tracing when they are off', async () => {
    await start(sentry({ dsn: 'https://k@o1.ingest.sentry.io/1' }), granted)
    expect(sdk.replayIntegration).not.toHaveBeenCalled()
    expect(sdk.browserTracingIntegration).not.toHaveBeenCalled()
  })

  it('holds the SDK and early errors until the deferred load', async () => {
    const manager = await start(sentry({ dsn: 'https://k@o1.ingest.sentry.io/1', defer: 'interaction' }))
    await manager.captureError(new Error('early'))
    expect(sdk.init).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('pointerdown'))
    await vi.waitFor(() => expect(sdk.captureException).toHaveBeenCalledTimes(1))
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })
})
