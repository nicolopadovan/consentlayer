import { autoTracking } from '../src/auto-tracking'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { getNames } from '../src/core/names'
import type { AnalyticsEventPayload, AnalyticsPlugin } from '../src/core/types'
import { cartParams, orderParams, productParams } from '../src/ecommerce'
import { ga4EventName, ga4UserData } from '../src/providers/ga4'
import { hotjar } from '../src/providers/hotjar'
import { meta, metaUserData, toMetaEvent } from '../src/providers/meta'
import {
  AnalyticsProvider,
  createGlobalError,
  ErrorBoundary,
  GtmNoscript,
  MetaPixelNoscript,
  useAnalytics,
  useConsent,
  useConsentController,
} from '../src/react'

const granted = { preferences: true, analytics: true, marketing: true }

function spyProvider(id: string, requiredConsent: AnalyticsPlugin['requiredConsent'] = 'analytics') {
  return {
    id,
    requiredConsent,
    track: vi.fn(),
    page: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  } satisfies AnalyticsPlugin
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

    expect(ga4.track).toHaveBeenCalledTimes(2)
    expect(hotjar.track).toHaveBeenCalledTimes(1)
    const [first] = ga4.track.mock.calls[0] as [AnalyticsEventPayload]
    const [second] = ga4.track.mock.calls[1] as [AnalyticsEventPayload]
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
    expect(localStorage.getItem('consentlayer_user_identity')).toContain('user_1')

    await analytics.reset()
    expect(meta.reset).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('consentlayer_user_identity')).toBeNull()
    analytics.destroy()
  })

  it("drops the previous user's email when a different user is identified", async () => {
    const analytics = createAnalytics()
    await analytics.identify('alice', { email: 'alice@example.com' })
    expect(localStorage.getItem('consentlayer_user_identity')).toBeNull()
    await analytics.consent.update(granted)
    await analytics.identify('bob', { plan: 'pro' })
    expect(JSON.parse(localStorage.getItem('consentlayer_user_identity') ?? '{}')).toEqual({ userId: 'bob' })
    analytics.destroy()
  })

  it('merges an update made before bootstrap into stored consent', async () => {
    localStorage.setItem('consentlayer_consent', JSON.stringify(granted))
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
    expect(meta.track).toHaveBeenCalledTimes(1)
    expect(ga4.track).not.toHaveBeenCalled()
    analytics.destroy()
  })

  it('keeps email and phone off the device and away from providers without marketing consent', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    await analytics.boot()
    await analytics.identify('u1', { email: 'a@example.com', plan: 'pro' })

    expect(ga4.identify).toHaveBeenLastCalledWith({ userId: 'u1' }, { plan: 'pro' }, expect.anything())
    expect(JSON.parse(localStorage.getItem('consentlayer_user_identity') ?? '{}')).toEqual({ userId: 'u1' })

    await analytics.consent.update({ marketing: true })
    await waitFor(() =>
      expect(ga4.identify).toHaveBeenLastCalledWith({ userId: 'u1', email: 'a@example.com' }, {}, expect.anything()),
    )
    expect(JSON.parse(localStorage.getItem('consentlayer_user_identity') ?? '{}')).toEqual({
      userId: 'u1',
      email: 'a@example.com',
    })

    await analytics.consent.update({ marketing: false })
    await waitFor(() => expect(ga4.identify).toHaveBeenLastCalledWith({ userId: 'u1' }, {}, expect.anything()))
    expect(JSON.parse(localStorage.getItem('consentlayer_user_identity') ?? '{}')).toEqual({ userId: 'u1' })

    await analytics.consent.update({ marketing: true })
    expect(localStorage.getItem('consentlayer_user_identity')).not.toContain('a@example.com')
    analytics.destroy()
  })

  it('clears email from a provider that stops on withdrawal', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update(granted)
    await analytics.boot()
    await analytics.identify(undefined, { email: 'a@example.com' })
    await analytics.consent.update({ analytics: false, marketing: false })
    await waitFor(() => expect(ga4.reset).toHaveBeenCalledTimes(1))
    expect(ga4.identify).toHaveBeenCalledTimes(1)
    analytics.destroy()
  })

  it('discards stored email when stored consent has no marketing', async () => {
    localStorage.setItem('consentlayer_user_identity', JSON.stringify({ userId: 'u1', email: 'a@example.com' }))
    localStorage.setItem('consentlayer_consent', JSON.stringify({ ...granted, marketing: false }))
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.bootstrap()
    await analytics.boot()
    await analytics.consent.update({ marketing: true })
    await waitFor(() => expect(analytics.consent.getConsent()?.marketing).toBe(true))
    expect(ga4.identify.mock.calls.flat()).not.toContainEqual(expect.objectContaining({ email: 'a@example.com' }))
    expect(localStorage.getItem('consentlayer_user_identity')).not.toContain('a@example.com')
    analytics.destroy()
  })

  it('checks requireMarketingConsent when a queued event is delivered', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update(granted)
    await analytics.track('sign_up', {}, { requireMarketingConsent: true })
    await analytics.consent.update({ marketing: false })
    await analytics.boot()
    expect(ga4.track).not.toHaveBeenCalled()
    analytics.destroy()
  })

  it('keeps the Meta pixel off after a withdrawal once it holds an email', () => {
    const fbq = vi.fn()
    Object.assign(window, { fbq, __consentlayerMetaPixelInitialized: undefined, __acmMetaPixelInitialized: undefined })
    const pixel = meta({ pixelId: '123456789012345' })
    const ctx = { debug: false, log: () => undefined, emitError: () => undefined }
    const on = { ...ctx, consent: granted, identity: { email: 'a@example.com' } }
    const off = { ...ctx, consent: { ...granted, marketing: false }, identity: {} }
    void pixel.load?.(on)
    window.fbq = fbq
    void pixel.consent?.(off)
    void pixel.consent?.({ ...on, identity: {} })
    void pixel.track?.(event('purchase', {}), { ...on, identity: {} })
    expect(fbq.mock.calls).toEqual([
      ['consent', 'revoke'],
      ['consent', 'revoke'],
    ])
  })

  it('delivers calls made before boot once providers are active', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    await analytics.identify('u1', { plan: 'pro' })
    await analytics.track('sign_up')
    expect(ga4.track).not.toHaveBeenCalled()

    await analytics.boot()
    expect(ga4.identify).toHaveBeenCalledOnce()
    expect(ga4.identify).toHaveBeenCalledWith({ userId: 'u1' }, { plan: 'pro' }, expect.anything())
    expect(ga4.track).toHaveBeenCalledTimes(1)
    analytics.destroy()
  })

  it('starts auto-tracking once analytics consent is granted', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({
      providers: [ga4],
      autoTracking: autoTracking({ clicks: false, scroll: false, timeOnPage: false, only: ['ga4'] }),
    })
    const hotjar = spyProvider('hotjar')
    analytics.registerProvider(hotjar)
    await analytics.boot()
    expect(ga4.track).not.toHaveBeenCalled()

    await analytics.consent.update({ analytics: true })
    await waitFor(() =>
      expect(ga4.track.mock.calls.map(([e]) => (e as AnalyticsEventPayload).name)).toContain(
        'consentlayer.page_session_start',
      ),
    )
    expect(hotjar.track).not.toHaveBeenCalled()
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
    expect(toMetaEvent(event('view_item', productParams({ id: 'p1', variantId: 'v1' }))).params.content_ids).toEqual([
      'v1',
    ])
    expect(toMetaEvent(event('schedule', {})).name).toBe('Schedule')
    expect(toMetaEvent(event('Donate', {})).method).toBe('track')
    expect(toMetaEvent(event('consentlayer.ui_click', { ui_target: 'Buy' }))).toEqual({
      method: 'trackCustom',
      name: 'consentlayer.ui_click',
      params: { ui_target: 'Buy' },
    })
  })

  it('maps event names GA4 would reject', () => {
    expect(ga4EventName('lead')).toBe('generate_lead')
    expect(ga4EventName('consentlayer.ui_click')).toBe('consentlayer_ui_click')
    expect(ga4EventName('purchase')).toBe('purchase')
  })

  it('builds checkout and purchase params from storefront shapes', () => {
    const lines = [
      { id: 'a', quantity: 2, price: { amount: 5, currencyCode: 'EUR' } },
      { id: 'b', price: { amount: 3, currencyCode: 'EUR' } },
    ]
    expect(cartParams({ lines })).toMatchObject({ value: 13, currency: 'EUR' })
    expect(orderParams({ orderId: 'o1', value: 13, currency: 'EUR', coupon: null, lines })).toMatchObject({
      transaction_id: 'o1',
      coupon: undefined,
      items: [{ item_id: 'a' }, { item_id: 'b' }],
    })
  })
})

describe('AnalyticsProvider', () => {
  it('boots, tracks the page per route and exposes the instance', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })

    function Probe() {
      const { consent } = useConsent()
      const instance = useAnalytics()
      return (
        <pre data-testid="probe">
          {String(instance === analytics)} {JSON.stringify(consent)}
        </pre>
      )
    }

    const { rerender } = render(
      <AnalyticsProvider analytics={analytics} routeKey="/a">
        <Probe />
      </AnalyticsProvider>,
    )
    await act(() => analytics.consent.update({ analytics: true }))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('probe').textContent).toContain('true {"preferences":false,"analytics":true')

    rerender(
      <AnalyticsProvider analytics={analytics} routeKey="/b">
        <Probe />
      </AnalyticsProvider>,
    )
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(2))
    analytics.destroy()
  })

  it('lets hooks outside the provider use the latest instance', async () => {
    const analytics = createAnalytics()
    function Probe() {
      const { consent } = useConsent()
      return (
        <pre data-testid="outside">
          {String(useAnalytics() === analytics)} {String(consent?.analytics)}
        </pre>
      )
    }
    render(<Probe />)
    await act(() => analytics.consent.update({ analytics: true }))
    expect(screen.getByTestId('outside').textContent).toBe('true true')
    analytics.destroy()
    expect(() => render(<Probe />)).toThrow('useAnalytics needs createAnalytics()')
  })

  it('warns when a second instance uses different names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const first = createAnalytics()
    const same = createAnalytics()
    expect(warn).not.toHaveBeenCalled()
    const other = createAnalytics({ names: { prefix: 'shop' } })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('one instance per page'))
    ;[first, same, other].forEach((instance) => instance.destroy())
    createAnalytics().destroy()
    expect(getNames().prefix).toBe('consentlayer')
    warn.mockRestore()
  })

  it('sends the current page to a provider that starts later on the same route', async () => {
    const ga4 = spyProvider('ga4')
    const meta = spyProvider('meta', 'marketing')
    const analytics = createAnalytics({ providers: [ga4, meta] })
    render(
      <AnalyticsProvider analytics={analytics} routeKey="/a">
        <span />
      </AnalyticsProvider>,
    )
    await act(() => analytics.consent.update({ analytics: true }))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(1))
    await act(() => analytics.consent.update({ marketing: true }))
    await waitFor(() => expect(meta.page).toHaveBeenCalledTimes(1))
    expect(ga4.page).toHaveBeenCalledTimes(1)
    analytics.destroy()
  })
})

describe('provider identity', () => {
  it('formats user data for GA4 and Meta', () => {
    expect(ga4UserData({ email: 'a@b.co', phone: '+15551234567' })).toEqual({
      email: 'a@b.co',
      phone_number: '+15551234567',
    })
    expect(ga4UserData({ userId: 'u1' })).toEqual({})
    expect(metaUserData({ userId: 'u1', email: 'a@b.co', phone: '+15551234567' })).toEqual({
      em: 'a@b.co',
      ph: '15551234567',
      external_id: 'u1',
    })
  })

  it('deletes Hotjar cookies and storage when analytics is withdrawn', () => {
    document.cookie = '_hjSessionUser_1=x; path=/'
    document.cookie = 'keep=1; path=/'
    localStorage.setItem('_hjUserAttributes', 'x')
    sessionStorage.setItem('hjViewportId', 'x')
    localStorage.setItem('hjActiveViewportIds', 'x')
    const plugin = hotjar({ siteId: 1, version: 6 })
    const ctx = { identity: {}, debug: false, log: () => undefined, emitError: () => undefined }
    void plugin.teardown?.({ ...ctx, consent: { preferences: false, analytics: true, marketing: false } })
    expect(document.cookie).toContain('_hjSessionUser_1')
    void plugin.teardown?.({ ...ctx, consent: { preferences: false, analytics: false, marketing: false } })
    expect(document.cookie).not.toContain('_hj')
    expect(document.cookie).toContain('keep=1')
    expect(localStorage.getItem('_hjUserAttributes')).toBeNull()
    expect(sessionStorage.getItem('hjViewportId')).toBeNull()
    expect(localStorage.getItem('hjActiveViewportIds')).toBeNull()
  })
})

describe('errors in React', () => {
  const monitor = () => ({ id: 'monitor', requiredConsent: 'none', error: vi.fn() }) satisfies AnalyticsPlugin
  function Boom(): never {
    throw new Error('render failed')
  }

  it('renders the fallback and captures the error', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const plugin = monitor()
    const analytics = createAnalytics({ providers: [plugin], errors: { globalHandlers: false } })
    await analytics.boot()
    render(
      <AnalyticsProvider analytics={analytics}>
        <ErrorBoundary tags={{ area: 'cart' }} fallback={({ reset }) => <button onClick={reset}>retry</button>}>
          <Boom />
        </ErrorBoundary>
      </AnalyticsProvider>,
    )
    expect(screen.getByText('retry')).toBeTruthy()
    await waitFor(() => expect(plugin.error).toHaveBeenCalledTimes(1))
    expect(plugin.error.mock.calls[0]?.[1]).toEqual({ source: 'boundary', tags: { area: 'cart' } })
    quiet.mockRestore()
  })

  it('boots the instance from global-error and captures with the digest', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const plugin = monitor()
    const GlobalError = createGlobalError(createAnalytics({ providers: [plugin] }))
    const error = Object.assign(new Error('layout failed'), { digest: 'd1' })
    render(<GlobalError error={error} reset={() => undefined} />)
    await waitFor(() => expect(plugin.error).toHaveBeenCalledTimes(1))
    expect(plugin.error.mock.calls[0]?.slice(0, 2)).toEqual([
      error,
      { source: 'boundary', level: 'fatal', tags: { digest: 'd1' } },
    ])
    expect(screen.getByText('Try again')).toBeTruthy()
    quiet.mockRestore()
  })
})

describe('withdrawal and failure paths', () => {
  it('stops providers even when a consent adapter throws, and reports it', async () => {
    const onError = vi.fn()
    const ga4 = { ...spyProvider('ga4'), teardown: vi.fn() }
    const analytics = createAnalytics({
      providers: [ga4],
      onError,
      consent: { adapters: [{ id: 'cmp', apply: () => Promise.reject(new Error('down')) }] },
    })
    await analytics.consent.update(granted)
    await analytics.boot()
    await analytics.consent.update({ analytics: false, marketing: false })
    await waitFor(() => expect(ga4.teardown).toHaveBeenCalledTimes(1))
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'consent-adapter', providerId: 'cmp' }))
    analytics.destroy()
  })

  it('works when localStorage throws', async () => {
    const blocked = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const analytics = createAnalytics()
    await analytics.consent.update(granted)
    await analytics.identify('u1')
    expect(analytics.consent.getConsent()).toEqual(granted)
    analytics.destroy()
    blocked.mockRestore()
  })

  it('stops auto-tracking events once analytics is withdrawn', async () => {
    const cookieless = spyProvider('cookieless', 'none')
    const analytics = createAnalytics({
      providers: [cookieless],
      autoTracking: autoTracking({ scroll: false, timeOnPage: false, pageViews: false }),
    })
    await analytics.consent.update(granted)
    await analytics.boot()
    const button = document.body.appendChild(document.createElement('button'))
    button.click()
    await waitFor(() => expect(cookieless.track).toHaveBeenCalledTimes(1))
    await analytics.consent.update({ analytics: false })
    button.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cookieless.track).toHaveBeenCalledTimes(1)
    button.remove()
    analytics.destroy()
  })

  it('runs plugin teardown on destroy', async () => {
    const ga4 = { ...spyProvider('ga4'), teardown: vi.fn() }
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update(granted)
    await analytics.boot()
    analytics.destroy()
    expect(ga4.teardown).toHaveBeenCalledTimes(1)
  })
})

describe('MetaPixelNoscript', () => {
  it('renders the pixel only when enabled and the pixel id is set', () => {
    const { container, rerender } = render(<MetaPixelNoscript enabled pixelId="123456789012345" />)
    expect(container.querySelector('noscript')).toBeTruthy()
    rerender(<MetaPixelNoscript enabled pixelId={undefined} />)
    expect(container.innerHTML).toBe('')
    rerender(<MetaPixelNoscript pixelId="123456789012345" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('GtmNoscript', () => {
  it('renders the iframe only when enabled and the container id is set', () => {
    const { container, rerender } = render(<GtmNoscript enabled containerId="GTM-ABC123" />)
    expect(container.querySelector('noscript')).toBeTruthy()
    rerender(<GtmNoscript containerId="GTM-ABC123" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('routeKey null', () => {
  it('holds page views until the route is known and starts no page session for it', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    const newPageSession = vi.spyOn(analytics, 'newPageSession')
    await analytics.consent.update({ analytics: true })
    await analytics.boot()
    const app = (routeKey: string | null) => (
      <AnalyticsProvider analytics={analytics} routeKey={routeKey}>
        <span />
      </AnalyticsProvider>
    )
    const { rerender } = render(app(null))
    await act(() => Promise.resolve())
    expect(ga4.page).not.toHaveBeenCalled()
    rerender(app('/a'))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(1))
    expect(newPageSession).not.toHaveBeenCalled()
    rerender(app(null))
    rerender(app('/b'))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(2))
    expect(newPageSession).toHaveBeenCalledTimes(1)
    analytics.destroy()
  })
})

describe('useConsentController', () => {
  it('lists the categories the dialog shows', () => {
    const analytics = createAnalytics({ categories: ['functional'] as never[] })
    const Categories = () => <span>{useConsentController().categories.join(',')}</span>
    render(
      <AnalyticsProvider analytics={analytics}>
        <Categories />
      </AnalyticsProvider>,
    )
    expect(screen.getByText('preferences,analytics,marketing,functional')).toBeTruthy()
    analytics.destroy()
  })

  it('shows the banner again for a stale choice it keeps', async () => {
    localStorage.setItem('consentlayer_consent', JSON.stringify({ consent: granted, policyVersion: '1' }))
    const analytics = createAnalytics({ consent: { policyVersion: '2', onStale: 'keep' } })
    const Banner = () => <span>{useConsentController().bannerVisible ? 'banner' : 'hidden'}</span>
    render(
      <AnalyticsProvider analytics={analytics}>
        <Banner />
      </AnalyticsProvider>,
    )
    await waitFor(() => expect(screen.getByText('banner')).toBeTruthy())
    expect(analytics.consent.getConsent()).toEqual(granted)
    analytics.destroy()
  })
})
