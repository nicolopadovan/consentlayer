export { createAnalytics, type AnalyticsOptions } from './core/create-analytics'
export { configureNames, getNames } from './core/names'
export { definePlugin, getFlag, loadScript, setFlag } from './core/plugin'
export type { AutoTrackingEventNames, Names, NamesInput } from './core/names'
export { createEnvConfig } from './core/presets'
export {
  createLocalStorageConsentStorage,
  createLocalStorageIdentityStorage,
  createMemoryConsentStorage,
  createMemoryIdentityStorage,
} from './core/storage'
export type {
  Analytics,
  AnalyticsError,
  AnalyticsErrorHandler,
  AnalyticsErrorScope,
  AnalyticsEventPayload,
  AnalyticsManagerStateSnapshot,
  AnalyticsPlugin,
  AutoTrackingClickConfig,
  AutoTrackingClickMode,
  AutoTrackingConfig,
  AutoTrackingScrollConfig,
  AutoTrackingTimeConfig,
  ConsentBroadcastConfig,
  ConsentChangeSource,
  ConsentApi,
  ConsentEngineSnapshot,
  ConsentIntegrationAdapter,
  ConsentState,
  ConsentStorageAdapter,
  EcommerceItem,
  ErrorContext,
  EventParams,
  IdentityStorageAdapter,
  LazyBootConfig,
  LazyBootMode,
  LoadTiming,
  PageEvent,
  PageViewPayload,
  PluginContext,
  ProviderConsentRequirement,
  ServerEvent,
  StandardEvents,
  TrackEventOptions,
  UserIdentity,
  UserTraits,
} from './core/types'
