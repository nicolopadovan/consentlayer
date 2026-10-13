import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsentController } from '../src/core/consent-controller'
import { createAnalytics } from '../src/core/create-analytics'
import type { AnalyticsPlugin } from '../src/core/types'

const spyProvider = (id: string, requiredConsent: AnalyticsPlugin['requiredConsent'] = 'analytics') =>
  ({ id, requiredConsent, page: vi.fn(), track: vi.fn() }) satisfies AnalyticsPlugin

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => localStorage.clear())

describe('createConsentController', () => {
  it('shows the banner without a stored choice and hides it once the visitor chooses', async () => {
    const analytics = createAnalytics({ providers: [] })
    const controller = createConsentController(analytics)
    const stop = controller.start()
    await settle()

    expect(controller.getSnapshot()).toMatchObject({ ready: true, bannerVisible: true })
    await controller.actions.acceptAll()
    expect(controller.getSnapshot()).toMatchObject({ bannerVisible: false, prefs: { analytics: true, marketing: true } })
    expect(analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: true })
    stop()
    analytics.destroy()
  })

  it('saves the toggles and notifies subscribers', async () => {
    const analytics = createAnalytics({ providers: [] })
    const controller = createConsentController(analytics)
    const listener = vi.fn()
    controller.subscribe(listener)
    const stop = controller.start()
    await settle()

    controller.actions.openDialog()
    controller.actions.setPrefs({ ...controller.getSnapshot().prefs, analytics: true })
    await controller.actions.savePreferences()

    expect(analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: false })
    expect(controller.getSnapshot().dialogVisible).toBe(false)
    expect(listener).toHaveBeenCalled()
    stop()
    analytics.destroy()
  })

  it('sends one page view per route and provider, and a page session from the second route on', async () => {
    const ga4 = spyProvider('ga4')
    const meta = spyProvider('meta', 'marketing')
    const analytics = createAnalytics({ providers: [ga4, meta] })
    const newPageSession = vi.spyOn(analytics, 'newPageSession')
    await analytics.consent.update({ analytics: true })
    const controller = createConsentController(analytics)
    const stop = controller.start()
    controller.setRoute('/a')
    await settle()

    expect(ga4.page).toHaveBeenCalledTimes(1)
    expect(newPageSession).not.toHaveBeenCalled()

    await analytics.consent.update({ marketing: true })
    await settle()
    expect(meta.page).toHaveBeenCalledTimes(1)
    expect(ga4.page).toHaveBeenCalledTimes(1)

    controller.setRoute('/b')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(2)
    expect(meta.page).toHaveBeenCalledTimes(2)
    expect(newPageSession).toHaveBeenCalledTimes(1)
    stop()
    analytics.destroy()
  })

  it('holds page views while the route is null', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    const controller = createConsentController(analytics)
    const stop = controller.start()
    controller.setRoute(null)
    await settle()
    expect(ga4.page).not.toHaveBeenCalled()

    controller.setRoute('/a')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(1)
    stop()
    analytics.destroy()
  })

  it('does not boot in manual mode', async () => {
    const analytics = createAnalytics({ providers: [] })
    const stop = createConsentController(analytics, { boot: { mode: 'manual' } }).start()
    await settle()
    expect(analytics.getSnapshot().booted).toBe(false)
    stop()
    analytics.destroy()
  })
})
