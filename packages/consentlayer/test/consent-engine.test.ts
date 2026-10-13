import { describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { createConsentEngine } from '../src/core/consent-engine'
import { createMemoryConsentStorage } from '../src/core/storage'
import { createShopifyCustomerPrivacyAdapter } from '../src/providers/shopify'

describe('consent engine', () => {
  it('prefers stored consent over adapter bootstrap', async () => {
    const storage = createMemoryConsentStorage({
      preferences: true,
      analytics: true,
      marketing: false,
    })
    const engine = createConsentEngine({
      storage,
      adapters: [
        {
          id: 'bootstrap-adapter',
          bootstrap: () => ({
            preferences: false,
            analytics: false,
            marketing: true,
          }),
        },
      ],
    })

    const consent = await engine.bootstrap()

    expect(consent).toEqual({
      preferences: true,
      analytics: true,
      marketing: false,
    })
  })

  it('reacts to storage-driven updates', async () => {
    const storage = createMemoryConsentStorage()
    const engine = createConsentEngine({ storage })
    const listener = vi.fn()
    engine.subscribe(listener)

    storage.write({
      preferences: true,
      analytics: false,
      marketing: false,
    })

    await Promise.resolve()

    expect(engine.getConsent()).toEqual({
      preferences: true,
      analytics: false,
      marketing: false,
    })
    expect(listener).toHaveBeenCalled()
  })

  it('persists consent, applies adapters, and broadcasts updates', async () => {
    const storage = createMemoryConsentStorage()
    const apply = vi.fn()
    const onConsent = vi.fn()
    document.addEventListener('acm:consent', onConsent)

    const engine = createConsentEngine({
      storage,
      adapters: [{ id: 'fanout', apply }],
      broadcast: {
        eventName: 'acm:consent',
        globalKey: 'ACM_CONSENT',
      },
    })

    await engine.setConsent({
      preferences: true,
      analytics: true,
      marketing: true,
    })

    expect(storage.read()).toEqual({
      preferences: true,
      analytics: true,
      marketing: true,
    })
    expect(apply).toHaveBeenCalledTimes(1)
    expect((window as unknown as Record<string, unknown>).ACM_CONSENT).toEqual({
      preferences: true,
      analytics: true,
      marketing: true,
    })
    expect(onConsent).toHaveBeenCalledTimes(1)
  })

  it('maps Shopify Customer Privacy bootstrap values', async () => {
    const adapter = createShopifyCustomerPrivacyAdapter({
      loadFeature: false,
      window: {
        Shopify: {
          customerPrivacy: {
            currentVisitorConsent: () => ({
              marketing: 'granted',
              analytics: 'denied',
              preferences: 'granted',
              sale_of_data: 'denied',
            }),
          },
        },
      } as unknown as Window,
      document,
    })

    await expect(adapter.bootstrap?.()).resolves.toEqual({
      preferences: true,
      analytics: false,
      marketing: true,
      sale_of_data: false,
    })
  })
})

describe('Shopify Customer Privacy sync', () => {
  it('pushes our consent to Shopify and takes consent collected by Shopify', async () => {
    const setTrackingConsent = vi.fn((_args: unknown, done?: () => void) => done?.())
    const win = { Shopify: { customerPrivacy: { setTrackingConsent } } } as unknown as Window
    const analytics = createAnalytics({
      consent: {
        adapters: [
          createShopifyCustomerPrivacyAdapter({
            loadFeature: false,
            window: win,
            document,
            headlessStorefront: { storefrontAccessToken: 'tok' },
          }),
        ],
      },
    })
    await analytics.consent.bootstrap()

    await analytics.consent.update({ analytics: true })
    expect(setTrackingConsent).toHaveBeenLastCalledWith(
      { preferences: false, analytics: true, marketing: false, headlessStorefront: true, storefrontAccessToken: 'tok' },
      expect.any(Function),
    )

    document.dispatchEvent(
      new CustomEvent('visitorConsentCollected', {
        detail: { analyticsAllowed: false, marketingAllowed: true, preferencesAllowed: true },
      }),
    )
    await vi.waitFor(() =>
      expect(analytics.consent.getConsent()).toEqual({ preferences: true, analytics: false, marketing: true }),
    )
    expect(setTrackingConsent).toHaveBeenCalledTimes(1)
    analytics.destroy()
  })
})
