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
    expect(controller.getSnapshot()).toMatchObject({
      bannerVisible: false,
      prefs: { analytics: true, marketing: true },
    })
    expect(analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: true })
    stop()
    analytics.destroy()
  })

  it('discards the toggles the visitor closes the dialog without saving', async () => {
    const analytics = createAnalytics({ providers: [] })
    const controller = createConsentController(analytics)
    const stop = controller.start()
    await settle()

    controller.actions.openDialog()
    controller.actions.setPrefs({ ...controller.getSnapshot().prefs, marketing: true })
    controller.actions.closeDialog()
    expect(controller.getSnapshot().prefs.marketing).toBe(false)
    controller.actions.openDialog()
    controller.actions.setPrefs({ ...controller.getSnapshot().prefs, analytics: true })
    await controller.actions.savePreferences()
    expect(analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: false })
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

  it('forwards a page view per route to each server destination once, and again to those a later grant allows', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const forwarded = () =>
      fetchMock.mock.calls.map(
        ([, init]) =>
          JSON.parse(init?.body as string) as { id: string; name: string; only?: string[]; categories?: string[] },
      )
    const ga4 = spyProvider('ga4')
    const meta = spyProvider('meta', 'marketing')
    const analytics = createAnalytics({ providers: [ga4, meta], server: { endpoint: '/api/analytics' } })
    await analytics.consent.update({ analytics: true })
    const controller = createConsentController(analytics)
    const stop = controller.start()
    controller.setRoute('/a')
    await settle()
    await analytics.consent.update({ marketing: true })
    await settle()
    expect(meta.page).toHaveBeenCalledTimes(1)
    expect(forwarded()).toEqual([
      expect.objectContaining({ name: 'page_view' }),
      expect.objectContaining({ name: 'page_view', categories: ['marketing'] }),
    ])
    expect(forwarded()[0]).not.toHaveProperty('only')
    expect(forwarded()[0]).not.toHaveProperty('categories')
    expect(forwarded()[0]?.id).not.toBe(forwarded()[1]?.id)

    await analytics.consent.update({ marketing: false })
    await analytics.consent.update({ marketing: true })
    await settle()
    expect(forwarded()).toHaveLength(2)

    controller.setRoute('/b')
    await settle()
    expect(forwarded()).toHaveLength(3)
    expect(forwarded()[2]).not.toHaveProperty('categories')
    stop()
    analytics.destroy()

    const serverOnly = createAnalytics({ providers: [], server: { endpoint: '/api/analytics' } })
    await serverOnly.consent.update({ analytics: true })
    const serverOnlyController = createConsentController(serverOnly)
    const stopServerOnly = serverOnlyController.start()
    serverOnlyController.setRoute('/')
    await settle()
    expect(forwarded()).toHaveLength(4)
    stopServerOnly()
    serverOnly.destroy()
    fetchMock.mockRestore()
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

  it('removes its openConsent global on stop unless another controller replaced it', () => {
    const analytics = createAnalytics({ providers: [] })
    const globals = window as unknown as Record<string, unknown>
    const stopFirst = createConsentController(analytics).start()
    stopFirst()
    expect(globals.CONSENTLAYER_openConsent).toBeUndefined()

    const stopOld = createConsentController(analytics).start()
    const stopNew = createConsentController(analytics).start()
    const current = globals.CONSENTLAYER_openConsent
    stopOld()
    expect(globals.CONSENTLAYER_openConsent).toBe(current)
    stopNew()
    expect(globals.CONSENTLAYER_openConsent).toBeUndefined()
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

  describe('Global Privacy Control', () => {
    const signal = (value: boolean | undefined) =>
      Object.defineProperty(navigator, 'globalPrivacyControl', { value, configurable: true })
    afterEach(() => signal(undefined))
    const started = async (options?: Parameters<typeof createAnalytics>[0]) => {
      const analytics = createAnalytics({ providers: [], ...options })
      const controller = createConsentController(analytics)
      const stop = controller.start()
      await settle()
      return { analytics, controller, stop }
    }

    it('keeps marketing off when the visitor accepts all, and exposes the signal', async () => {
      signal(true)
      const { analytics, controller, stop } = await started()
      expect(controller.getSnapshot()).toMatchObject({ gpc: true, bannerVisible: true, prefs: { marketing: false } })
      expect(analytics.consent.gpc).toBe(true)
      await controller.actions.acceptAll()
      expect(analytics.consent.getConsent()).toMatchObject({ preferences: true, analytics: true, marketing: false })
      stop()
      analytics.destroy()
    })

    it('lets an explicit marketing choice win over the signal', async () => {
      signal(true)
      const { analytics, controller, stop } = await started()
      controller.actions.setPrefs({ ...controller.getSnapshot().prefs, marketing: true })
      await controller.actions.savePreferences()
      expect(analytics.consent.getConsent()).toMatchObject({ marketing: true })
      await analytics.consent.update({ marketing: false })
      await analytics.consent.update({ marketing: true })
      expect(analytics.consent.getConsent()).toMatchObject({ marketing: true })
      stop()
      analytics.destroy()
    })

    it('is ignored with consent.gpc set to false, or without the signal', async () => {
      signal(true)
      const off = await started({ consent: { gpc: false } })
      expect(off.controller.getSnapshot().gpc).toBe(false)
      await off.controller.actions.acceptAll()
      expect(off.analytics.consent.getConsent()).toMatchObject({ marketing: true })
      off.stop()
      off.analytics.destroy()
      localStorage.clear()

      signal(false)
      const absent = await started()
      expect(absent.controller.getSnapshot().gpc).toBe(false)
      await absent.controller.actions.acceptAll()
      expect(absent.analytics.consent.getConsent()).toMatchObject({ marketing: true })
      absent.stop()
      absent.analytics.destroy()
    })
  })
})
