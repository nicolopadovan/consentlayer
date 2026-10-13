import { createAnalyticsManager } from './analytics-manager'
import { createConsentEngine } from './consent-engine'
import { configureNames, getNames, withLegacy, type NamesInput } from './names'
import {
  createLocalStorageConsentStorage,
  createLocalStorageIdentityStorage,
} from './storage'
import type {
  Analytics,
  AnalyticsManagerOptions,
  ConsentEngineOptions,
  ConsentIntegrationAdapter,
  ConsentState,
} from './types'
import { assertHttpsOrRelativeUrl } from './validation'

/** Options for `createAnalytics`. */
export type AnalyticsOptions = Omit<
  AnalyticsManagerOptions,
  'consent' | 'consentEngine'
> & {
  /** Storage, CMP integrations (e.g. Shopify Customer Privacy) and broadcast. Defaults to localStorage. */
  consent?: Omit<ConsentEngineOptions, 'debug'>
  /** Your own categories, declared in `ConsentCategories`. Stored, broadcast and sent to the server like the built-in ones. */
  categories?: ConsentEngineOptions['categories']
  /** Renames storage keys, globals and DOM events. */
  names?: NamesInput
}

let latest: { analytics: Analytics; names: string } | undefined

/** The most recent `createAnalytics()` instance, for hooks used outside `<AnalyticsProvider>`. */
export const latestAnalytics = (): Analytics | undefined => latest?.analytics

/** Creates the analytics instance. Nothing loads until `boot()` (which `<AnalyticsProvider>` calls) and then only what consent allows. */
export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  const { consent: consentOptions, categories, names, ...managerOptions } = options
  configureNames(names)

  const consentEndpoint =
    options.server?.consentEndpoint !== undefined
      ? assertHttpsOrRelativeUrl(options.server.consentEndpoint, 'server.consentEndpoint')
      : undefined
  const recorder: ConsentIntegrationAdapter = {
    id: 'consent-endpoint',
    async apply(consent) {
      const response = await fetch(consentEndpoint!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consent }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    },
  }

  const engine = createConsentEngine({
    storage: createLocalStorageConsentStorage({ key: getNames().consentStorageKey }),
    broadcast: {
      eventName: withLegacy((n) => n.consentEventName),
      globalKey: withLegacy((n) => n.consentGlobalKey),
    },
    ...consentOptions,
    adapters: [...(consentOptions?.adapters ?? []), ...(consentEndpoint ? [recorder] : [])],
    categories,
    debug: options.debug,
    onError: options.onError,
  })
  const manager = createAnalyticsManager({
    identityStorage: createLocalStorageIdentityStorage({
      key: getNames().identityStorageKey,
    }),
    ...managerOptions,
    consentEngine: engine,
  })

  const analytics: Analytics = {
    boot: manager.boot,
    registerProvider: manager.registerProvider,
    page: manager.page,
    track: manager.track,
    identify: manager.identify,
    reset: manager.reset,
    group: manager.group,
    captureError: manager.captureError,
    newPageSession: manager.newPageSession,
    getSnapshot: manager.getSnapshot,
    subscribe: manager.subscribe,
    consent: {
      categories: engine.categories,
      bootstrap: engine.bootstrap,
      getConsent: engine.getConsent,
      setConsent: engine.setConsent,
      subscribe: engine.subscribe,
      async update(partial) {
        await engine.bootstrap()
        const denied = Object.fromEntries(engine.categories.map((category) => [category, false]))
        await engine.setConsent({ ...denied, ...engine.getConsent(), ...partial } as ConsentState)
      },
    },
    destroy() {
      manager.destroy()
      engine.destroy()
      if (latest?.analytics === analytics) latest = undefined
    },
  }
  const namesKey = JSON.stringify(names ?? {})
  if (latest && latest.names !== namesKey) {
    console.warn(
      '[consentlayer] createAnalytics() was called again with different names. Storage keys, globals and events are per page, so the last names win: create one instance per page.',
    )
  }
  latest = { analytics, names: namesKey }
  return analytics
}
