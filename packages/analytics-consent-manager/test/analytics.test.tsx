import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import type { AnalyticsEventPayload, ProviderAdapter } from '../src/core/types'
import { cartParams, orderParams, productParams } from '../src/ecommerce'
import { ga4EventName } from '../src/providers/ga4'
import { toMetaEvent } from '../src/providers/meta'
import { AnalyticsProvider, useAnalytics, useConsent } from '../src/react'

const granted = { preferences: true, analytics: true, marketing: true }

function spyProvider(id: string, requiredConsent: ProviderAdapter['requiredConsent'] = 'analytics') {
  return {
    id,
    requiredConsent,
    trackEvent: vi.fn(),
    trackPage: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  } satisfies ProviderAdapter
}

const event = (
  name: string,
  params: Record<string, unknown>,
  options: AnalyticsEventPayload['options'] = {},
): AnalyticsEventPayload => ({ id: 'e1', name, params, options })

afterEach(() => localStorage.clear())

describe('createAnalytics', () => {
  it('gives every event an id and honours `only`', async () => {
    const ga4 = spyProvider('ga4')
    const hotjar = spyProvider('hotjar')
    const analytics = createAnalytics({ providers: [ga4, hotjar] })
    await analytics.consent.update(granted)
    await analytics.boot()

    await analytics.track('sign_up', { method: 'google' })
    await analytics.track('login', {}, { only: ['ga4'], eventId: 'fixed' })

    expect(ga4.trackEvent).toHaveBeenCalledTimes(2)
    expect(hotjar.trackEvent).toHaveBeenCalledTimes(1)
    const [first] = ga4.trackEvent.mock.calls[0] as [AnalyticsEventPayload]
    const [second] = ga4.trackEvent.mock.calls[1] as [AnalyticsEventPayload]
    expect(first.id).toMatch(/.+/)
    expect(second.id).toBe('fixed')
    analytics.destroy()
  })

  it('merges partial consent updates into denied defaults', async () => {
    const analytics = createAnalytics()
    await analytics.consent.update({ analytics: true })
    expect(analytics.consent.getConsent()).toEqual({
      preferences: false,
      analytics: true,
      marketing: false,
    })
    await analytics.consent.update({ marketing: true })
    expect(analytics.consent.getConsent()?.analytics).toBe(true)
    analytics.destroy()
  })

  it('stores identity, replays it to providers that load later, and resets', async () => {
    const meta = spyProvider('meta', 'marketing')
    const analytics = createAnalytics({ providers: [meta] })
    await analytics.boot()

    await analytics.identify('user_1', { email: 'A@Example.com', plan: 'pro' })
    expect(meta.identify).not.toHaveBeenCalled()

    await analytics.consent.update(granted)
    await waitFor(() => expect(meta.identify).toHaveBeenCalledTimes(1))
    expect(meta.identify.mock.calls[0]?.[0]).toEqual({
      userId: 'user_1',
      email: 'a@example.com',
    })
    expect(localStorage.getItem('npcm_user_identity')).toContain('user_1')

    await analytics.reset()
    expect(meta.reset).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('npcm_user_identity')).toBeNull()
    analytics.destroy()
  })

  it('drops the previous user\'s email when a different user is identified', async () => {
    const analytics = createAnalytics()
    await analytics.identify('alice', { email: 'alice@example.com' })
    await analytics.identify('bob', { plan: 'pro' })
    expect(JSON.parse(localStorage.getItem('npcm_user_identity') ?? '{}')).toEqual({ userId: 'bob' })
    analytics.destroy()
  })

  it('merges an update made before bootstrap into stored consent', async () => {
    localStorage.setItem(
      'npcm_consent',
      JSON.stringify(granted),
    )
    const analytics = createAnalytics()
    await analytics.consent.update({ preferences: false })
    expect(analytics.consent.getConsent()).toEqual({ ...granted, preferences: false })
    analytics.destroy()
  })

  it('sends events to a marketing provider without analytics consent', async () => {
    const meta = spyProvider('meta', 'marketing')
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [meta, ga4] })
    await analytics.consent.update({ marketing: true })
    await analytics.boot()
    await analytics.track('purchase', { transaction_id: 'o1' })
    expect(meta.trackEvent).toHaveBeenCalledTimes(1)
    expect(ga4.trackEvent).not.toHaveBeenCalled()
    analytics.destroy()
  })

  it('starts auto-tracking once analytics consent is granted', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({
      providers: [ga4],
      autoTracking: { clicks: false, scroll: false, timeOnPage: false, only: ['ga4'] },
    })
    const hotjar = spyProvider('hotjar')
    analytics.registerProvider(hotjar)
    await analytics.boot()
    expect(ga4.trackEvent).not.toHaveBeenCalled()

    await analytics.consent.update({ analytics: true })
    await waitFor(() =>
      expect(ga4.trackEvent.mock.calls.map(([e]) => (e as AnalyticsEventPayload).name)).toContain(
        'npcm.page_session_start',
      ),
    )
    expect(hotjar.trackEvent).not.toHaveBeenCalled()
    analytics.destroy()
  })
})

describe('event translation', () => {
  it('maps standard events and items to Meta', () => {
    const translated = toMetaEvent(
      event(
        'add_to_cart',
        productParams({
          id: 'p1',
          quantity: 2,
          price: { amount: '9.5', currencyCode: 'EUR' },
        }),
        { providers: { meta: { content_category: 'shoes' }, ga4: { ignored: true } } },
      ),
    )
    expect(translated).toEqual({
      method: 'track',
      name: 'AddToCart',
      params: {
        value: 19,
        currency: 'EUR',
        content_ids: ['p1'],
        contents: [{ id: 'p1', quantity: 2, item_price: 9.5 }],
        content_type: 'product',
        num_items: 2,
        content_category: 'shoes',
      },
    })
    expect(toMetaEvent(event('search', { search_term: 'boots' })).params).toEqual({
      search_string: 'boots',
    })
    expect(
      toMetaEvent(event('view_item', productParams({ id: 'p1', variantId: 'v1' }))).params
        .content_ids,
    ).toEqual(['v1'])
    expect(toMetaEvent(event('schedule', {})).name).toBe('Schedule')
    expect(toMetaEvent(event('Donate', {})).method).toBe('track')
    expect(toMetaEvent(event('npcm.ui_click', { ui_target: 'Buy' }))).toEqual({
      method: 'trackCustom',
      name: 'npcm.ui_click',
      params: { ui_target: 'Buy' },
    })
  })

  it('maps event names GA4 would reject', () => {
    expect(ga4EventName('lead')).toBe('generate_lead')
    expect(ga4EventName('npcm.ui_click')).toBe('npcm_ui_click')
    expect(ga4EventName('purchase')).toBe('purchase')
  })

  it('builds checkout and purchase params from storefront shapes', () => {
    const lines = [
      { id: 'a', quantity: 2, price: { amount: 5, currencyCode: 'EUR' } },
      { id: 'b', price: { amount: 3, currencyCode: 'EUR' } },
    ]
    expect(cartParams({ lines })).toMatchObject({ value: 13, currency: 'EUR' })
    expect(
      orderParams({ orderId: 'o1', value: 13, currency: 'EUR', coupon: null, lines }),
    ).toMatchObject({ transaction_id: 'o1', coupon: undefined, items: [{ item_id: 'a' }, { item_id: 'b' }] })
  })
})

describe('AnalyticsProvider', () => {
  it('boots, tracks the page per route and exposes the instance', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })

    function Probe() {
      const { consent } = useConsent()
      const instance = useAnalytics()
      return <pre data-testid="probe">{String(instance === analytics)} {JSON.stringify(consent)}</pre>
    }

    const { rerender } = render(
      <AnalyticsProvider analytics={analytics} routeKey="/a">
        <Probe />
      </AnalyticsProvider>,
    )
    await act(() => analytics.consent.update({ analytics: true }))
    await waitFor(() => expect(ga4.trackPage).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('probe').textContent).toContain('true {"preferences":false,"analytics":true')

    rerender(
      <AnalyticsProvider analytics={analytics} routeKey="/b">
        <Probe />
      </AnalyticsProvider>,
    )
    await waitFor(() => expect(ga4.trackPage).toHaveBeenCalledTimes(2))
    analytics.destroy()
  })
})
