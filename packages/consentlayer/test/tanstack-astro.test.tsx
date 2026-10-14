import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { consentLayer } from '../src/astro'
import { createAnalytics } from '../src/core/create-analytics'
import { AnalyticsProvider } from '../src/tanstack-start'

// TanStack Router scrolls to the top after a navigation; jsdom does not implement scrolling.
window.scrollTo = () => undefined

const spyProvider = () => ({ id: 'ga4', requiredConsent: 'analytics' as const, page: vi.fn() })

afterEach(() => localStorage.clear())

describe('consentlayer/tanstack-start', () => {
  it('sends one page view per loaded route, query changes included, after the loader', async () => {
    const ga4 = spyProvider()
    const analytics = createAnalytics({ providers: [ga4] })
    let release = () => undefined as void
    const rootRoute = createRootRoute({
      component: () => (
        <AnalyticsProvider analytics={analytics}>
          <Outlet />
        </AnalyticsProvider>
      ),
    })
    const routes = [
      createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <p>home</p> }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/slow',
        loader: () => new Promise<void>((resolve) => (release = resolve)),
        component: () => <p>slow</p>,
      }),
    ]
    const router = createRouter({
      routeTree: rootRoute.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(<RouterProvider router={router} />)
    await screen.findByText('home')
    await act(() => analytics.consent.update({ analytics: true }))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(1))

    await act(() => router.navigate({ to: '/', search: { q: 1 } }))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(2))

    let navigation!: Promise<void>
    act(() => {
      navigation = router.navigate({ to: '/slow' })
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(ga4.page).toHaveBeenCalledTimes(2)
    await act(async () => {
      release()
      await navigation
    })
    await screen.findByText('slow')
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(3))
    analytics.destroy()
  })
})

describe('consentlayer/astro', () => {
  it('sends a page view on load and on each astro:page-load with a new URL', async () => {
    const ga4 = spyProvider()
    const analytics = createAnalytics({ providers: [ga4] })
    const controller = consentLayer(analytics)
    await waitFor(() => expect(controller.getSnapshot().ready).toBe(true))
    await analytics.consent.update({ analytics: true })
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(1))

    document.dispatchEvent(new Event('astro:page-load'))
    await Promise.resolve()
    expect(ga4.page).toHaveBeenCalledTimes(1)

    history.pushState(null, '', '/next?q=1')
    document.dispatchEvent(new Event('astro:page-load'))
    await waitFor(() => expect(ga4.page).toHaveBeenCalledTimes(2))
    history.pushState(null, '', '/')
    analytics.destroy()
  })
})
