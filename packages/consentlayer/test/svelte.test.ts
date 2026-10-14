import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import type { AnalyticsPlugin } from '../src/core/types'
import type { AfterNavigateLike } from '../src/svelte'
import { handleErrorWith } from '../src/sveltekit'
import App from './svelte/App.svelte'

const spyProvider = (id: string) =>
  ({ id, requiredConsent: 'analytics', page: vi.fn(), track: vi.fn() }) satisfies AnalyticsPlugin

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  flushSync()
}

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('consentlayer/svelte', () => {
  it('renders the banner state and records the choice', async () => {
    const analytics = createAnalytics({ providers: [] })
    const app = mount(App, { target: document.body, props: { analytics } })
    await settle()

    document.querySelector<HTMLButtonElement>('#accept')!.click()
    await settle()

    expect(document.querySelector('#accept')).toBeNull()
    expect(document.querySelector('pre')!.textContent).toContain('"marketing":true')
    void unmount(app)
    analytics.destroy()
  })

  it('sends a page view per navigation, without the hash', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    let navigate: Parameters<AfterNavigateLike>[0] = () => undefined
    const afterNavigate: AfterNavigateLike = (callback) => {
      navigate = callback
    }
    const go = (url: string) => navigate({ to: { url: new URL(url, 'https://example.com') } })
    const app = mount(App, { target: document.body, props: { analytics, afterNavigate } })
    go('/')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(1)

    go('/shop?page=2')
    await settle()
    go('/shop?page=2#reviews')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(2)
    void unmount(app)
    analytics.destroy()
  })

  it('sends one page view without afterNavigate, and stops on unmount', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    const app = mount(App, { target: document.body, props: { analytics } })
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(1)
    void unmount(app)
    analytics.destroy()
  })
})

describe('handleErrorWith', () => {
  it('sends only the errors your code threw', () => {
    const analytics = createAnalytics({ providers: [] })
    const captureError = vi.spyOn(analytics, 'captureError').mockResolvedValue(undefined)
    const handleError = handleErrorWith(analytics)
    const error = new Error('boom')
    handleError({ kind: 'unknown', error })
    handleError({ kind: 'framework', error: { status: 404, message: 'Not Found' } })
    expect(captureError).toHaveBeenCalledExactlyOnceWith(error, { source: 'boundary' })
    analytics.destroy()
  })
})
