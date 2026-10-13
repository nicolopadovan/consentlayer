import { act, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { AnalyticsProvider } from '../src/next'

const route = vi.hoisted(() => ({ pathname: '/a', search: '', pages: null as { isReady: boolean } | null }))
vi.mock('next/compat/router.js', () => ({ useRouter: () => route.pages }))
vi.mock('next/navigation.js', () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search),
}))

afterEach(() => localStorage.clear())

describe('consentlayer/next', () => {
  it('sends one page view per route, query changes included', async () => {
    const ga4 = { id: 'ga4', requiredConsent: 'analytics' as const, page: vi.fn() }
    const analytics = createAnalytics({ providers: [ga4] })
    const app = () => (
      <AnalyticsProvider analytics={analytics}>
        <p>page</p>
      </AnalyticsProvider>
    )
    const { rerender } = render(app())
    expect(screen.getByText('page')).toBeTruthy()
    await act(() => analytics.consent.update({ analytics: true }))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(1))

    route.search = 'q=1'
    rerender(app())
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(2))
    route.pathname = '/b'
    route.search = ''
    rerender(app())
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(3))
    rerender(app())
    await act(() => Promise.resolve())
    expect(ga4.page).toHaveBeenCalledTimes(3)
    analytics.destroy()
  })

  it('waits for the Pages Router to be ready', async () => {
    route.pathname = '/p'
    route.search = ''
    route.pages = { isReady: false }
    const ga4 = { id: 'ga4', requiredConsent: 'analytics' as const, page: vi.fn() }
    const analytics = createAnalytics({ providers: [ga4] })
    const app = () => (
      <AnalyticsProvider analytics={analytics}>
        <p>page</p>
      </AnalyticsProvider>
    )
    const { rerender } = render(app())
    await act(() => analytics.consent.update({ analytics: true }))
    expect(ga4.page).not.toHaveBeenCalled()

    route.pages = { isReady: true }
    route.search = 'q=1'
    rerender(app())
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(1))
    route.pathname = '/q'
    route.search = ''
    rerender(app())
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(2))
    route.pages = null
    analytics.destroy()
  })

  it('renders the page on the server', () => {
    const analytics = createAnalytics()
    expect(
      renderToString(
        <AnalyticsProvider analytics={analytics}>
          <p>server page</p>
        </AnalyticsProvider>,
      ),
    ).toContain('server page')
    analytics.destroy()
  })
})
