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

  it('leaves an undecided Shopify sale_of_data unset', async () => {
    const adapter = createShopifyCustomerPrivacyAdapter({
      loadFeature: false,
      window: {
        Shopify: {
          customerPrivacy: {
            currentVisitorConsent: () => ({ marketing: 'yes', analytics: 'no', preferences: '', sale_of_data: '' }),
          },
        },
      } as unknown as Window,
      document,
    })

    await expect(adapter.bootstrap?.()).resolves.toEqual({
      preferences: false,
      analytics: false,
      marketing: true,
    })
  })
})

describe('setConsent', () => {
  it('rejects anything but boolean categories', async () => {
    const engine = createConsentEngine({ storage: createMemoryConsentStorage() })
    await expect(engine.setConsent(null as never)).rejects.toThrow(TypeError)
    await expect(
      engine.setConsent({ preferences: false, analytics: 'false', marketing: false } as never),
    ).rejects.toThrow(/boolean preferences, analytics and marketing/)
    expect(engine.getConsent()).toBeNull()
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

describe('custom categories', () => {
  // The package declares no ConsentCategories, so 'functional' is cast here; apps/docs checks the types.
  const categories = ['functional'] as never[]

  it('stores, broadcasts and syncs them, and gates a provider', async () => {
    const chat = { id: 'chat', requiredConsent: 'functional' as never, load: vi.fn(), track: vi.fn() }
    const analytics = createAnalytics({ categories, providers: [chat] })
    const broadcast = vi.fn()
    document.addEventListener('consentlayer:consent', broadcast)
    await analytics.boot()

    expect(analytics.consent.categories).toEqual(['preferences', 'analytics', 'marketing', 'functional'])
    await analytics.consent.update({ analytics: true })
    await analytics.track('open_chat')
    expect(chat.load).not.toHaveBeenCalled()
    expect(analytics.consent.getConsent()).toMatchObject({ functional: false })

    await analytics.consent.update({ functional: true } as never)
    await vi.waitFor(() => expect(analytics.getSnapshot().activeProviders).toEqual(['chat']))
    await analytics.track('open_chat')
    expect(chat.load).toHaveBeenCalledTimes(1)
    expect(chat.track).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('consentlayer_consent')!)).toMatchObject({ functional: true })
    expect((broadcast.mock.calls.at(-1)?.[0] as CustomEvent).detail).toMatchObject({ functional: true })

    document.removeEventListener('consentlayer:consent', broadcast)
    analytics.destroy()
    localStorage.clear()
  })

  it('rejects consent without them and keeps them when an adapter does not know them', async () => {
    let push: (consent: { preferences: boolean; analytics: boolean; marketing: boolean }) => void = () => {}
    const engine = createConsentEngine({
      categories,
      storage: createMemoryConsentStorage(),
      adapters: [{ id: 'cmp', subscribe: (listener) => { push = listener; return () => {} } }],
    })
    await expect(
      engine.setConsent({ preferences: true, analytics: true, marketing: true }),
    ).rejects.toThrow('boolean preferences, analytics, marketing and functional')

    await engine.setConsent({ preferences: false, analytics: false, marketing: false, functional: true } as never)
    push({ preferences: false, analytics: true, marketing: false })
    await Promise.resolve()
    expect(engine.getConsent()).toEqual({ preferences: false, analytics: true, marketing: false, functional: true })
  })
})
