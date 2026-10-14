import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { clarity } from '../src/providers/clarity'
import { ga4 } from '../src/providers/ga4'
import { googleAds } from '../src/providers/google-ads'
import { linkedin } from '../src/providers/linkedin'

const denied = { preferences: false, analytics: false, marketing: false }
const analyticsOnly = { ...denied, analytics: true }
const all = { preferences: true, analytics: true, marketing: true }

const win = window as unknown as Record<string, unknown>
const scripts = (match: string) => [...document.scripts].filter((script) => script.src.includes(match))
const cookieNames = () => document.cookie.split('; ').filter(Boolean).map((cookie) => cookie.split('=')[0])
const gtagCalls = () =>
  (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>).filter((arg) => !(arg instanceof Date)))

beforeEach(() => {
  for (const key of Object.keys(win)) {
    if (key.startsWith('__consentlayer') || ['dataLayer', 'gtag', 'clarity', 'lintrk'].includes(key)) delete win[key]
  }
  delete win._linkedin_partner_id
  delete win._linkedin_data_partner_ids
  document.head.replaceChildren()
  for (const name of cookieNames()) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
})

describe('googleAds', () => {
  it('is off without a conversion ID and rejects a malformed one', () => {
    expect(Object.keys(googleAds({ conversionId: ' ' }))).toEqual(['id', 'requiredConsent', 'setup'])
    expect(() => googleAds({ conversionId: 'G-123' })).toThrow(/Google Ads conversion ID/)
  })

  it('loads and sends nothing before marketing consent, then sends page views and mapped conversions only', async () => {
    const manager = createAnalyticsManager({
      providers: [googleAds({ conversionId: 'AW-123', conversions: { purchase: 'buy', lead_form: 'lead' } })],
      consent: analyticsOnly,
    })
    await manager.boot()
    await manager.page({ path: '/a', url: 'https://example.com/a', title: 'A' })
    await manager.track('purchase', { transaction_id: 'o1', value: 10, currency: 'EUR' })
    expect(scripts('googletagmanager')).toEqual([])
    expect(gtagCalls()).toEqual([
      ['consent', 'default', expect.objectContaining({ ad_storage: 'denied' })],
      ['consent', 'update', expect.objectContaining({ ad_storage: 'denied', analytics_storage: 'granted' })],
    ])

    window.dataLayer = []
    await manager.updateConsent(all)
    await manager.page({ path: '/b', url: 'https://example.com/b', title: 'B' })
    await manager.track('purchase', { transaction_id: 'o2', value: 20, currency: 'EUR', items: [] })
    await manager.track('lead_form')
    await manager.track('sign_up', { method: 'email' })
    expect(scripts('googletagmanager').map((script) => script.src)).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=AW-123',
    ])
    expect(gtagCalls()).toEqual([
      ['consent', 'update', expect.objectContaining({ ad_storage: 'granted' })],
      ['js'],
      ['config', 'AW-123', { send_page_view: false }],
      [
        'event',
        'page_view',
        { page_location: 'https://example.com/b', page_path: '/b', page_title: 'B', send_to: 'AW-123' },
      ],
      ['event', 'conversion', { value: 20, currency: 'EUR', transaction_id: 'o2', send_to: 'AW-123/buy' }],
      ['event', 'conversion', { send_to: 'AW-123/lead' }],
    ])
    manager.destroy()
  })

  it('sends no page views with pageViews: false and expires _gcl_ cookies when marketing is withdrawn', async () => {
    const manager = createAnalyticsManager({
      providers: [googleAds({ conversionId: 'AW-123', pageViews: false })],
      consent: all,
    })
    await manager.boot()
    await manager.page()
    await manager.track('purchase', { transaction_id: 'o1', value: 1 })
    expect(gtagCalls().filter(([command]) => command === 'event')).toEqual([])
    for (const name of ['_gcl_au', '_gcl_aw', 'keep']) document.cookie = `${name}=1; path=/`
    await manager.updateConsent(analyticsOnly)
    expect(cookieNames()).toEqual(['keep'])
    manager.destroy()
  })

  it('shares one gtag.js and one set of Consent Mode defaults with ga4, each event addressed to its own tag', async () => {
    const manager = createAnalyticsManager({
      providers: [ga4({ measurementId: 'G-ABC123' }), googleAds({ conversionId: 'AW-123' })],
      consent: denied,
    })
    await manager.boot()
    await manager.updateConsent(analyticsOnly)
    await manager.updateConsent(all)
    await manager.page({ path: '/a', url: 'https://example.com/a', title: 'A' })
    expect(scripts('googletagmanager').map((script) => script.src)).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-ABC123',
    ])
    const calls = gtagCalls()
    expect(calls.filter(([command, type]) => command === 'consent' && type === 'default')).toHaveLength(1)
    expect(calls.filter(([command]) => command === 'js')).toHaveLength(1)
    expect(calls.filter(([command]) => command === 'config').map(([, id]) => id)).toEqual(['G-ABC123', 'AW-123'])
    expect(
      calls.filter(([, name]) => name === 'page_view').map(([, , params]) => (params as { send_to: string }).send_to),
    ).toEqual(['G-ABC123', 'AW-123'])
    manager.destroy()
  })
})

describe('clarity', () => {
  const queue = () => (window.clarity?.q ?? []).map((args) => Array.from(args as ArrayLike<unknown>))

  it('is off without a project ID and rejects a malformed one', () => {
    expect(Object.keys(clarity({ projectId: undefined }))).toEqual(['id', 'requiredConsent', 'setup'])
    expect(() => clarity({ projectId: 'abc/../x' })).toThrow(/Clarity project ID/)
  })

  it('loads nothing before analytics consent, then passes every consent change to Clarity', async () => {
    const manager = createAnalyticsManager({ providers: [clarity({ projectId: 'abc123' })], consent: denied })
    await manager.boot()
    await manager.track('sign_up')
    await manager.identify('u1')
    expect(window.clarity).toBeUndefined()
    expect(scripts('clarity.ms')).toEqual([])

    await manager.updateConsent(analyticsOnly)
    expect(scripts('clarity.ms').map((script) => script.src)).toEqual(['https://www.clarity.ms/tag/abc123'])
    await manager.track('sign_up')
    await manager.updateConsent(all)
    await manager.updateConsent(denied)
    expect(queue()).toEqual([
      ['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }],
      ['identify', 'u1'],
      ['event', 'sign_up'],
      ['consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' }],
      ['consent', false],
    ])
    manager.destroy()
  })

  it('sends no events or identity when they are switched off', async () => {
    const manager = createAnalyticsManager({
      providers: [clarity({ projectId: 'abc123', events: false, identify: false })],
      consent: analyticsOnly,
    })
    await manager.boot()
    await manager.identify('u1')
    await manager.track('sign_up')
    expect(queue().map(([command]) => command)).toEqual(['consentv2'])
    manager.destroy()
  })
})

describe('linkedin', () => {
  it('is off without a partner ID and rejects a malformed one', () => {
    expect(Object.keys(linkedin({ partnerId: '' }))).toEqual(['id', 'requiredConsent', 'setup'])
    expect(() => linkedin({ partnerId: '12a' })).toThrow(/LinkedIn partner ID/)
  })

  it('loads nothing before marketing consent, then sends mapped conversions only', async () => {
    const manager = createAnalyticsManager({
      providers: [linkedin({ partnerId: ' 123\n', conversions: { purchase: 111, lead_form: 222 } })],
      consent: analyticsOnly,
    })
    await manager.boot()
    await manager.track('purchase', { transaction_id: 'o1' })
    expect(window.lintrk).toBeUndefined()
    expect(scripts('licdn')).toEqual([])

    await manager.updateConsent(all)
    expect(scripts('licdn').map((script) => script.src)).toEqual([
      'https://snap.licdn.com/li.lms-analytics/insight.min.js',
    ])
    expect(win._linkedin_partner_id).toBe('123')
    expect(win._linkedin_data_partner_ids).toEqual(['123'])
    await manager.track('purchase', { transaction_id: 'o1' }, { eventId: 'e1' })
    await manager.track('lead_form', {}, { eventId: 'e2' })
    await manager.track('sign_up')
    expect(window.lintrk?.q).toEqual([
      ['track', { conversion_id: 111, event_id: 'e1' }],
      ['track', { conversion_id: 222, event_id: 'e2' }],
    ])

    document.cookie = 'li_fat_id=1; path=/'
    document.cookie = 'keep=1; path=/'
    await manager.updateConsent(analyticsOnly)
    await manager.track('purchase', { transaction_id: 'o3' })
    expect(cookieNames()).toEqual(['keep'])
    expect(window.lintrk?.q).toHaveLength(2)
    manager.destroy()
  })

  it('defers loading with defer', async () => {
    vi.useFakeTimers()
    const manager = createAnalyticsManager({
      providers: [linkedin({ partnerId: 123, conversions: { purchase: 111 }, defer: 1000 })],
      consent: all,
    })
    await manager.boot()
    await manager.track('purchase', { transaction_id: 'o1' }, { eventId: 'e1' })
    expect(window.lintrk).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1000)
    expect(window.lintrk?.q).toEqual([['track', { conversion_id: 111, event_id: 'e1' }]])
    manager.destroy()
    vi.useRealTimers()
  })
})
