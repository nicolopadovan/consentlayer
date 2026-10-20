import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import type { AnalyticsManagerOptions, AnalyticsPlugin } from '../src/core/types'
import { createRedact } from '../src/core/utils'
import { contentsquare } from '../src/providers/contentsquare'
import { ga4 } from '../src/providers/ga4'

const granted = { preferences: false, analytics: true, marketing: true }

const collector = () =>
  ({
    id: 'collector',
    requiredConsent: 'none',
    page: vi.fn<NonNullable<AnalyticsPlugin['page']>>(),
    track: vi.fn<NonNullable<AnalyticsPlugin['track']>>(),
    identify: vi.fn<NonNullable<AnalyticsPlugin['identify']>>(),
  }) satisfies AnalyticsPlugin

const start = async (plugin: AnalyticsPlugin, options: Partial<AnalyticsManagerOptions> = {}) => {
  const manager = createAnalyticsManager({ providers: [plugin], consent: granted, ...options })
  await manager.boot()
  return manager
}

afterEach(() => {
  history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('createRedact', () => {
  it('redacts emails, encoded or not, and the listed query parameters', () => {
    const redact = createRedact({ queryParams: ['token', 'u.id'] })
    expect(redact('https://a.com/users/jane.doe+x@example.co.uk/?email=jane%40example.com&TOKEN=abc&q=1#u.id=2')).toBe(
      'https://a.com/users/(redacted)/?email=(redacted)&TOKEN=(redacted)&q=1#u.id=2',
    )
    expect(redact('/p?u.id=7')).toBe('/p?u.id=(redacted)')
    expect(redact('/p?uxid=7')).toBe('/p?uxid=7')
    expect(createRedact({ emails: false })('a@b.com')).toBe('a@b.com')
    expect(createRedact(false)('a@b.com')).toBe('a@b.com')
  })
})

describe('redaction', () => {
  it('redacts page views, event params and server events, but never identify data', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchMock)
    history.replaceState({}, '', '/thanks?email=jane%40example.com&ref=x')
    const plugin = collector()
    const manager = await start(plugin, { server: { endpoint: '/api/analytics' } })

    await manager.page()
    await manager.track('sign_up', { method: 'jane@example.com', items: [{ note: 'to a@b.io' }], value: 1 })
    await manager.identify('u1', { email: 'jane@example.com' })

    expect(plugin.page.mock.calls[0]?.[0]).toMatchObject({
      url: 'http://localhost:3000/thanks?email=(redacted)&ref=x',
      path: '/thanks?email=(redacted)&ref=x',
    })
    expect(plugin.track.mock.calls[0]?.[0].params).toEqual({
      method: '(redacted)',
      items: [{ note: 'to (redacted)' }],
      value: 1,
    })
    expect(plugin.identify.mock.calls.at(-1)?.[0]).toMatchObject({ email: 'jane@example.com' })
    const bodies = fetchMock.mock.calls.map((call) => (call as unknown as [string, RequestInit])[1].body as string)
    expect(bodies.join()).not.toContain('jane')
    expect(bodies.join()).toContain('email=(redacted)')
    manager.destroy()
  })

  it('sends everything unchanged with redact: false', async () => {
    history.replaceState({}, '', '/thanks?email=jane%40example.com')
    const plugin = collector()
    const manager = await start(plugin, { redact: false })
    await manager.page()
    await manager.track('sign_up', { method: 'jane@example.com' })
    expect(plugin.page.mock.calls[0]?.[0].url).toContain('jane%40example.com')
    expect(plugin.track.mock.calls[0]?.[0].params).toEqual({ method: 'jane@example.com' })
    manager.destroy()
  })

  it('sets the redacted URL and referrer on gtag, so its own hits send them', async () => {
    window.dataLayer = []
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://mail.example/?to=jane@example.com')
    history.replaceState({}, '', '/thanks?email=jane%40example.com')
    const manager = await start(ga4({ measurementId: 'G-REDACT1' }))
    await manager.page()
    const set = window.dataLayer
      .map((entry) => Array.from(entry as ArrayLike<unknown>))
      .find(([command, value]) => command === 'set' && typeof value === 'object' && 'page_location' in value!)
    expect(set?.[1]).toEqual({
      page_location: 'http://localhost:3000/thanks?email=(redacted)',
      page_referrer: 'https://mail.example/?to=(redacted)',
    })
    manager.destroy()
  })

  it('masks the query string and referrer that Contentsquare reads itself', async () => {
    window._uxa = []
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://mail.example/?to=jane@example.com')
    history.replaceState({}, '', '/a?email=jane%40example.com')
    const manager = await start(contentsquare({ tagId: 'redact123456' }))
    history.pushState({}, '', '/b?email=jo%40example.com')
    await manager.page()
    expect(window._uxa).toEqual([
      ['setQuery', '?email=(redacted)'],
      ['referrer:removeQueryString'],
      ['setQuery', '?email=(redacted)'],
      ['trackPageview', '/b'],
    ])
    manager.destroy()
  })
})
