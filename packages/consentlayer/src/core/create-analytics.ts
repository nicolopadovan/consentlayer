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
  ConsentState,
} from './types'

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

/** Creates the analytics instance. Nothing loads until `boot()` (which `<AnalyticsProvider>` calls) and then only what consent allows. */
export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  const { consent: consentOptions, categories, names, ...managerOptions } = options
  if (names) configureNames(names)

  const engine = createConsentEngine({
    storage: createLocalStorageConsentStorage({ key: getNames().consentStorageKey }),
    broadcast: {
      eventName: withLegacy((n) => n.consentEventName),
      globalKey: withLegacy((n) => n.consentGlobalKey),
    },
    ...consentOptions,
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

  return {
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
    },
  }
}
