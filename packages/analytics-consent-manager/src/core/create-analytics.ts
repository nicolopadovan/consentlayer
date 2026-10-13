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

export type AnalyticsOptions = Omit<
  AnalyticsManagerOptions,
  'consent' | 'consentEngine'
> & {
  /** Storage, CMP integrations (e.g. Shopify Customer Privacy) and broadcast. Defaults to localStorage. */
  consent?: Omit<ConsentEngineOptions, 'debug'>
  /** Renames storage keys, globals, DOM events and CSS classes. */
  names?: NamesInput
}

const DENIED: ConsentState = {
  preferences: false,
  analytics: false,
  marketing: false,
}

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
    newPageSession: manager.newPageSession,
    getSnapshot: manager.getSnapshot,
    subscribe: manager.subscribe,
    consent: {
      ...engine,
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
