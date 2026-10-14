import { Route, Router, useNavigate } from '@solidjs/router'
import { createComponent, createSignal, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import type { Analytics, AnalyticsPlugin } from '../src/core/types'
import {
  AnalyticsProvider,
  ErrorBoundary,
  GtmNoscript,
  MetaPixelNoscript,
  useConsent,
  useConsentController,
} from '../src/solid'
import { AnalyticsProvider as SolidStartAnalyticsProvider } from '../src/solidstart'

const spyProvider = (id: string) =>
  ({ id, requiredConsent: 'analytics', page: vi.fn(), track: vi.fn() }) satisfies AnalyticsPlugin

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// Solid Router scrolls to the top after a navigation; jsdom does not implement scrolling.
window.scrollTo = () => undefined

function Banner(): JSX.Element {
  const controller = useConsentController()
  const { consent } = useConsent()
  const accept = document.createElement('button')
  accept.id = 'accept'
  accept.onclick = () => void controller.acceptAll()
  const pre = document.createElement('pre')
  return [
    () => (controller.ready && controller.bannerVisible ? accept : null),
    () => {
      pre.textContent = JSON.stringify(consent())
      return pre
    },
  ] as unknown as JSX.Element
}

const mount = (analytics: Analytics, routeKey?: () => string) =>
  render(
    () =>
      createComponent(AnalyticsProvider, {
        analytics,
        get routeKey() {
          return routeKey?.()
        },
        get children() {
          return createComponent(Banner, {})
        },
      }),
    document.body,
  )

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('consentlayer/solid', () => {
  it('renders the banner state and records the choice', async () => {
    const analytics = createAnalytics({ providers: [] })
    const dispose = mount(analytics)
    await settle()

    document.querySelector<HTMLButtonElement>('#accept')!.click()
    await settle()

    expect(document.querySelector('#accept')).toBeNull()
    expect(document.querySelector('pre')!.textContent).toContain('"marketing":true')
    dispose()
    analytics.destroy()
  })

  it('sends a page view per route key, and stops on unmount', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    const [routeKey, setRouteKey] = createSignal('/')
    const dispose = mount(analytics, routeKey)
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(1)

    setRouteKey('/shop?page=2')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(2)
    dispose()
    analytics.destroy()
  })

  it('reports errors caught by ErrorBoundary and renders the fallback', async () => {
    const analytics = createAnalytics({ providers: [] })
    const captureError = vi.spyOn(analytics, 'captureError').mockResolvedValue(undefined)
    const error = new Error('boom')
    const dispose = render(
      () =>
        createComponent(ErrorBoundary, {
          analytics,
          tags: { area: 'test' },
          fallback: (caught) => `failed: ${(caught as Error).message}`,
          get children() {
            return createComponent(() => {
              throw error
            }, {})
          },
        }),
      document.body,
    )
    await settle()
    expect(document.body.textContent).toBe('failed: boom')
    expect(captureError).toHaveBeenCalledExactlyOnceWith(error, { source: 'boundary', tags: { area: 'test' } })
    dispose()
    analytics.destroy()
  })

  it('renders the Meta noscript pixel only when enabled with an ID', () => {
    const [enabled, setEnabled] = createSignal(false)
    const dispose = render(
      () =>
        createComponent(MetaPixelNoscript, {
          pixelId: '123',
          loading: 'lazy',
          get enabled() {
            return enabled()
          },
        }),
      document.body,
    )
    expect(document.querySelector('noscript')).toBeNull()
    setEnabled(true)
    expect(document.querySelector('noscript')!.innerHTML).toContain(
      'loading="lazy" alt="" src="https://www.facebook.com/tr?id=123&amp;ev=PageView&amp;noscript=1"',
    )
    dispose()
  })

  it('renders the GTM noscript iframe only when enabled with an ID', () => {
    const [enabled, setEnabled] = createSignal(false)
    const dispose = render(
      () =>
        createComponent(GtmNoscript, {
          containerId: 'GTM-ABC123',
          loading: 'lazy',
          get enabled() {
            return enabled()
          },
        }),
      document.body,
    )
    expect(document.querySelector('noscript')).toBeNull()
    setEnabled(true)
    expect(document.querySelector('noscript')!.innerHTML).toContain(
      'src="https://www.googletagmanager.com/ns.html?id=GTM-ABC123"',
    )
    dispose()
  })
})

describe('consentlayer/solidstart', () => {
  it('sends a page view per navigation, after the URL changes, without the hash', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    let navigate: (to: string) => void = () => undefined
    const dispose = render(
      () =>
        createComponent(Router, {
          root: (props) =>
            createComponent(SolidStartAnalyticsProvider, {
              analytics,
              get children() {
                navigate = useNavigate()
                return props.children
              },
            }),
          get children() {
            return createComponent(Route, { path: '*', component: () => null })
          },
        }),
      document.body,
    )
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(1)

    navigate('/shop?page=2')
    await settle()
    expect(ga4.page).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/shop?page=2' }), expect.anything())
    navigate('/shop?page=2#reviews')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(2)
    dispose()
    analytics.destroy()
  })
})
