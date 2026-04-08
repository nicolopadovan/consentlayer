import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import { ConsentProvider, useConsent } from '../src/react'
import { describe, expect, it, vi } from 'vitest'
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

  it('does not destroy an externally provided engine on provider unmount', async () => {
    const engine = createConsentEngine({
      storage: createMemoryConsentStorage(),
    })

    function Reader() {
      const { consent } = useConsent()
      return createElement('pre', undefined, JSON.stringify(consent))
    }

    const { unmount } = render(
      createElement(
        ConsentProvider,
        {
          engine,
          children: createElement(Reader),
        },
      ),
    )

    unmount()

    await act(async () => {
      await engine.setConsent({
        preferences: true,
        analytics: true,
        marketing: true,
      })
    })

    expect(engine.getConsent()).toEqual({
      preferences: true,
      analytics: true,
      marketing: true,
    })
  })
})
