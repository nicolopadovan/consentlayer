import { describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { createConsentEngine } from '../src/core/consent-engine'
import { createMemoryConsentStorage } from '../src/core/storage'
import { shopifyCustomerPrivacy, getShopifyCustomerPrivacyScriptUrl } from '../src/adapters/shopify'

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

  it('shows observers the consent at creation and after every change, whatever its source', async () => {
    const stored = { preferences: true, analytics: true, marketing: false }
    const fromTab = { preferences: false, analytics: true, marketing: false }
    const storage = createMemoryConsentStorage(stored)
    const observe = vi.fn()
    const onError = vi.fn()
    const engine = createConsentEngine({
      storage,
      adapters: [
        { id: 'observer', observe },
        {
          id: 'broken',
          observe: () => {
            throw new Error('boom')
          },
        },
      ],
      onError,
    })
    expect(observe.mock.calls).toEqual([[null]])
    await engine.bootstrap()
    storage.write({ consent: fromTab })
    await Promise.resolve()
    await engine.setConsent({ ...fromTab, marketing: true })
    expect(observe.mock.calls.slice(1)).toEqual([[stored], [fromTab], [{ ...fromTab, marketing: true }]])
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'consent-adapter', providerId: 'broken' }))
  })

  it('reacts to storage-driven updates', async () => {
    const storage = createMemoryConsentStorage()
    const engine = createConsentEngine({ storage })
    const listener = vi.fn()
    engine.subscribe(listener)

    storage.write({ consent: { preferences: true, analytics: false, marketing: false } })

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

    expect(storage.read()?.consent).toEqual({
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
    const adapter = shopifyCustomerPrivacy({
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
    const adapter = shopifyCustomerPrivacy({
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
          shopifyCustomerPrivacy({
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

  it('waits for Shopify and loads its script on headless storefronts', async () => {
    let done: (() => void) | undefined
    const setTrackingConsent = vi.fn((_args: unknown, callback?: () => void) => (done = callback))
    const win = { Shopify: { customerPrivacy: { setTrackingConsent } } } as unknown as Window
    const adapter = shopifyCustomerPrivacy({ window: win, document })
    let applied = false
    const apply = Promise.resolve(adapter.apply?.({ preferences: false, analytics: true, marketing: false })).then(
      () => (applied = true),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applied).toBe(false)
    done?.()
    await apply

    const headless = shopifyCustomerPrivacy({
      window: {} as Window,
      document,
      headlessStorefront: { storefrontAccessToken: 'tok' },
    })
    void headless.bootstrap?.()
    expect([...document.scripts].map((script) => script.src)).toContain(getShopifyCustomerPrivacyScriptUrl())
  })

  it('stays on the hosted-theme call while the storefront token is unset', async () => {
    const setTrackingConsent = vi.fn((_args: unknown, done?: () => void) => done?.())
    const win = { Shopify: { customerPrivacy: { setTrackingConsent } } } as unknown as Window
    const adapter = shopifyCustomerPrivacy({
      loadFeature: false,
      window: win,
      document,
      headlessStorefront: { storefrontAccessToken: undefined },
    })
    await adapter.apply?.({ preferences: false, analytics: true, marketing: false })
    expect(setTrackingConsent).toHaveBeenCalledWith(
      { preferences: false, analytics: true, marketing: false },
      expect.any(Function),
    )
  })
})

describe('bootstrap precedence', () => {
  const denied = { preferences: false, analytics: false, marketing: false }
  const granted = { preferences: true, analytics: true, marketing: true }

  it('keeps a choice made while an adapter bootstrap is pending', async () => {
    let answer: (consent: typeof denied) => void = () => undefined
    const storage = createMemoryConsentStorage()
    const engine = createConsentEngine({
      storage,
      adapters: [{ id: 'slow', bootstrap: () => new Promise((resolve) => (answer = resolve)) }],
    })
    const bootstrapping = engine.bootstrap()
    await engine.setConsent(granted)
    answer(denied)
    expect(await bootstrapping).toEqual(granted)
    expect(storage.read()?.consent).toEqual(granted)
    engine.destroy()
  })

  it('asks an authoritative adapter before the stored choice and falls back to it on null or failure', async () => {
    const stored = { preferences: true, analytics: true, marketing: false }
    const engineWith = (bootstrap: () => Promise<typeof denied | null>, onError = vi.fn()) =>
      createConsentEngine({
        storage: createMemoryConsentStorage(stored),
        adapters: [{ id: 'cmp', authoritative: true, bootstrap }],
        onError,
      })

    let answer: (consent: typeof denied) => void = () => undefined
    const decided = engineWith(() => new Promise((resolve) => (answer = resolve)))
    const bootstrapping = decided.bootstrap()
    await Promise.resolve()
    expect(decided.getConsent()).toBeNull()
    answer(denied)
    expect(await bootstrapping).toEqual(denied)

    expect(await engineWith(async () => null).bootstrap()).toEqual(stored)
    const onError = vi.fn()
    expect(await engineWith(() => Promise.reject(new Error('timeout')), onError).bootstrap()).toEqual(stored)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'consent-adapter', providerId: 'cmp' }))
  })
})

describe('adapter failures', () => {
  it('reports a failed bootstrap and asks the next adapter', async () => {
    const onError = vi.fn()
    const engine = createConsentEngine({
      adapters: [
        { id: 'broken', bootstrap: () => Promise.reject(new Error('boom')) },
        { id: 'next', bootstrap: () => ({ preferences: false, analytics: true, marketing: false }) },
      ],
      onError,
    })
    expect(await engine.bootstrap()).toEqual({ preferences: false, analytics: true, marketing: false })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'consent-adapter', providerId: 'broken' }))
    engine.destroy()
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
    expect((JSON.parse(localStorage.getItem('consentlayer_consent')!) as { consent: object }).consent).toMatchObject({
      functional: true,
    })
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
      adapters: [
        {
          id: 'cmp',
          subscribe: (listener) => {
            push = listener
            return () => {}
          },
        },
      ],
    })
    await expect(engine.setConsent({ preferences: true, analytics: true, marketing: true })).rejects.toThrow(
      'boolean preferences, analytics, marketing and functional',
    )

    await engine.setConsent({ preferences: false, analytics: false, marketing: false, functional: true } as never)
    push({ preferences: false, analytics: true, marketing: false })
    await Promise.resolve()
    expect(engine.getConsent()).toEqual({ preferences: false, analytics: true, marketing: false, functional: true })
  })
})

describe('consent endpoint', () => {
  it('treats an empty endpoint as unset', () => {
    expect(() => createAnalytics({ server: { endpoint: '', consentEndpoint: '' } }).destroy()).not.toThrow()
  })

  it('posts each choice, not the restored one, and reports a failed post', async () => {
    localStorage.setItem(
      'consentlayer_consent',
      JSON.stringify({ preferences: false, analytics: true, marketing: false }),
    )
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const onError = vi.fn()
    const analytics = createAnalytics({ server: { consentEndpoint: '/api/consent' }, onError })

    await analytics.consent.bootstrap()
    expect(fetchMock).not.toHaveBeenCalled()
    await analytics.consent.update({ marketing: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/consent', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      consent: { preferences: false, analytics: true, marketing: true },
    })

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await analytics.consent.update({ marketing: false })
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'consent-adapter', providerId: 'consent-endpoint' }),
    )

    vi.unstubAllGlobals()
    analytics.destroy()
    localStorage.clear()
  })
})

describe('stale choices', () => {
  const choice = { preferences: false, analytics: true, marketing: false }
  const day = 86_400_000
  const stored = (record: object) => {
    const storage = createMemoryConsentStorage()
    storage.write(record as never)
    return storage
  }

  it('discards a choice older than maxAgeDays and refreshes it when confirmed', async () => {
    const storage = stored({ consent: choice, updatedAt: Date.now() - 31 * day })
    const apply = vi.fn()
    const engine = createConsentEngine({ storage, maxAgeDays: 30, adapters: [{ id: 'record', apply }] })
    expect(await engine.bootstrap()).toBeNull()
    expect(engine.isStale()).toBe(true)

    await engine.setConsent(choice)
    expect(engine.isStale()).toBe(false)
    expect(storage.read()?.updatedAt).toBeGreaterThan(Date.now() - 1000)
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('keeps a stale choice in force with onStale: keep, and records the same choice again', async () => {
    const storage = stored({ consent: choice, policyVersion: '1' })
    const apply = vi.fn()
    const engine = createConsentEngine({
      storage,
      policyVersion: '2',
      onStale: 'keep',
      adapters: [{ id: 'record', apply }],
    })
    expect(await engine.bootstrap()).toEqual(choice)
    expect(engine.isStale()).toBe(true)

    await engine.setConsent(choice)
    expect(engine.isStale()).toBe(false)
    expect(storage.read()?.policyVersion).toBe('2')
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('treats a choice without a date or policy version as stale only when those options are set', async () => {
    const legacy = () => stored({ consent: choice })
    expect(await createConsentEngine({ storage: legacy() }).bootstrap()).toEqual(choice)
    expect(await createConsentEngine({ storage: legacy(), maxAgeDays: 365 }).bootstrap()).toBeNull()
    expect(await createConsentEngine({ storage: legacy(), policyVersion: '1' }).bootstrap()).toBeNull()
    expect(await createConsentEngine({ storage: legacy(), policyVersion: ' ' }).bootstrap()).toEqual(choice)
    const minor = () => stored({ consent: choice, policyVersion: '3.1' })
    expect(await createConsentEngine({ storage: minor(), policyVersion: '3.2' }).bootstrap()).toEqual(choice)
    expect(await createConsentEngine({ storage: minor(), policyVersion: '4.0' }).bootstrap()).toBeNull()
    const dated = () => stored({ consent: choice, policyVersion: '2026-10-01' })
    expect(await createConsentEngine({ storage: dated(), policyVersion: '2026-11-15' }).bootstrap()).toBeNull()
    const fresh = stored({ consent: choice, updatedAt: Date.now(), policyVersion: '1' })
    expect(await createConsentEngine({ storage: fresh, maxAgeDays: 1, policyVersion: '1' }).bootstrap()).toEqual(choice)
  })

  it('rejects a maxAgeDays that is not a positive number', () => {
    expect(() => createConsentEngine({ maxAgeDays: 0 })).toThrow('consent.maxAgeDays must be a positive number')
    expect(() => createConsentEngine({ maxAgeDays: Number.NaN })).toThrow('consent.maxAgeDays')
  })

  it('reads values stored before 1.0 as a choice without a date', async () => {
    localStorage.setItem('consentlayer_consent', JSON.stringify(choice))
    const analytics = createAnalytics()
    expect(await analytics.consent.bootstrap()).toEqual(choice)
    await analytics.consent.update({ marketing: true })
    expect(JSON.parse(localStorage.getItem('consentlayer_consent')!)).toMatchObject({
      consent: { ...choice, marketing: true },
      updatedAt: expect.any(Number) as number,
    })
    analytics.destroy()
    localStorage.clear()
  })
})
