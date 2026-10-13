import { createAnalyticsManager } from './analytics-manager'
import { createConsentEngine } from './consent-engine'
import { setDefaultIdentityStorage } from './identity'
import {
  createLocalStorageConsentStorage,
  createLocalStorageIdentityStorage,
} from './storage'
import { getNames, withLegacy } from './names'
import type {
  AnalyticsManager,
  ConsentEngine,
  ConsentState,
  ProviderAdapter,
  TrackEventOptions,
} from './types'

const defaultIdentityStorage = createLocalStorageIdentityStorage({
  get key() {
    return getNames().identityStorageKey
  },
})

setDefaultIdentityStorage(defaultIdentityStorage)

let defaultConsentEngine: ConsentEngine = createConsentEngine({
  storage: createLocalStorageConsentStorage({
    get key() {
      return getNames().consentStorageKey
    },
  }),
  broadcast: {
    get eventName() {
      return withLegacy((names) => names.consentEventName)
    },
    get globalKey() {
      return withLegacy((names) => names.consentGlobalKey)
    },
  },
})

let defaultAnalyticsManager: AnalyticsManager = createAnalyticsManager({
  consentEngine: defaultConsentEngine,
  identityStorage: defaultIdentityStorage,
})

export function getDefaultConsentEngine(): ConsentEngine {
  return defaultConsentEngine
}

export function setDefaultConsentEngine(engine: ConsentEngine): void {
  defaultConsentEngine = engine
}

export function getDefaultRuntimeAnalyticsManager(): AnalyticsManager {
  return defaultAnalyticsManager
}

export function setDefaultRuntimeAnalyticsManager(
  manager: AnalyticsManager,
): void {
  defaultAnalyticsManager = manager
}

export async function updateConsent(consent: ConsentState): Promise<void> {
  await defaultConsentEngine.setConsent(consent)
}

export function registerProvider(provider: ProviderAdapter): () => void {
  return defaultAnalyticsManager.registerProvider(provider)
}

export async function trackPage(): Promise<void> {
  await defaultAnalyticsManager.trackPage()
}

export async function trackEvent(
  name: string,
  params: Record<string, unknown> = {},
  options: TrackEventOptions = {},
): Promise<void> {
  await defaultAnalyticsManager.trackEvent(name, params, options)
}

export function enableAutoTracking(): void {
  defaultAnalyticsManager.enableAutoTracking()
}

export function newPageSession(): void {
  defaultAnalyticsManager.newPageSession()
}
