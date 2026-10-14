import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import type { AnalyticsPlugin, DebugEntry, DebugOptions } from '../src/core/types'

const spyProvider = (id: string) =>
  ({ id, requiredConsent: 'analytics', page: vi.fn(), track: vi.fn() }) satisfies AnalyticsPlugin

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const run = async (debug: boolean | DebugOptions) => {
  const analytics = createAnalytics({ providers: [spyProvider('ga4'), spyProvider('posthog')], debug })
  await analytics.consent.update({ analytics: true })
  await analytics.boot()
  await analytics.page({ path: '/a' })
  await analytics.track('sign_up', { method: 'email' })
  analytics.destroy()
}

describe('debug', () => {
  it('logs every topic to the console with true', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    await run(true)
    const messages = debug.mock.calls.map((call): unknown => call[1])
    expect(messages).toEqual(expect.arrayContaining(['consent updated', 'boot', 'ga4.page', 'posthog.track']))
    expect(debug).toHaveBeenCalledWith('[consentlayer]', 'ga4.track', 'sign_up', { method: 'email' })
  })

  it('keeps only the chosen topics and providers, and sends them to the logger', async () => {
    const debug = vi.spyOn(console, 'debug')
    const entries: DebugEntry[] = []
    await run({ events: true, only: ['ga4'], logger: (entry) => entries.push(entry) })
    expect(debug).not.toHaveBeenCalled()
    expect(entries.map((entry) => entry.message)).toEqual(['ga4.page', 'ga4.track'])
    expect(entries[1]).toEqual({
      topic: 'events',
      provider: 'ga4',
      message: 'ga4.track',
      data: ['sign_up', { method: 'email' }],
    })
  })

  it('logs every topic but the ones set to false', async () => {
    const entries: DebugEntry[] = []
    await run({ events: false, logger: (entry) => entries.push(entry) })
    expect(new Set(entries.map((entry) => entry.topic))).toEqual(new Set(['consent', 'providers']))
  })
  it('reports events that are held, dropped or reach no provider', async () => {
    const entries: string[] = []
    const logger = (entry: DebugEntry) => entries.push(entry.message)
    const analytics = createAnalytics({ providers: [spyProvider('ga4')], debug: { events: true, logger } })
    await analytics.track('sign_up')
    await analytics.boot()
    await analytics.track('purchase')
    analytics.destroy()
    const off = createAnalytics({ providers: [], enabled: false, debug: { events: true, logger } })
    await off.page()
    off.destroy()
    expect(entries).toEqual([
      'sign_up held until boot',
      'sign_up reached no provider',
      'purchase reached no provider',
      'page dropped: enabled is false',
    ])
  })

  it('counts only providers that handle the call', async () => {
    const entries: string[] = []
    const logger = (entry: DebugEntry) => entries.push(entry.message)
    const analytics = createAnalytics({ providers: [spyProvider('ga4')], debug: { errors: true, logger } })
    await analytics.consent.update({ analytics: true })
    await analytics.boot()
    await analytics.captureError(new Error('boom'))
    analytics.destroy()
    expect(entries).toEqual(['captureError reached no provider'])
  })
})
