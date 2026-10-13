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
  /** Renames storage keys, globals and DOM events. */
  names?: NamesInput
}

const DENIED: ConsentState = {
  preferences: false,
  analytics: false,
  marketing: false,
}

/** Creates the analytics instance. Nothing loads until `boot()` (which `<AnalyticsProvider>` calls) and then only what consent allows. */
export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  const { consent: consentOptions, names, ...managerOptions } = options
  if (names) configureNames(names)

  const engine = createConsentEngine({
    storage: createLocalStorageConsentStorage({ key: getNames().consentStorageKey }),
    broadcast: {
      eventName: withLegacy((n) => n.consentEventName),
      globalKey: withLegacy((n) => n.consentGlobalKey),
    },
    ...consentOptions,
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
      bootstrap: engine.bootstrap,
      getConsent: engine.getConsent,
      setConsent: engine.setConsent,
      subscribe: engine.subscribe,
      async update(partial) {
        await engine.bootstrap()
        await engine.setConsent({ ...DENIED, ...engine.getConsent(), ...partial })
      },
    },
    destroy() {
      manager.destroy()
      engine.destroy()
    },
  }
}
