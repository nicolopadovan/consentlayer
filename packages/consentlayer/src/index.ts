export { createAnalytics, type AnalyticsOptions } from './core/create-analytics'
export {
  createConsentController,
  type ConsentController,
  type ConsentControllerActions,
  type ConsentControllerOptions,
  type ConsentControllerState,
} from './core/consent-controller'
export { getNames } from './core/names'
export { definePlugin, getFlag, loadScript, setFlag } from './core/plugin'
export type { AutoTrackingEventNames, Names, NamesInput } from './core/names'
export { createEnvConfig } from './core/presets'
export type { EnvConfigInput } from './core/presets'
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
  ConsentBootstrapAnswer,
  ConsentCategories,
  ConsentCategory,
  ConsentEngineSnapshot,
  ConsentIntegrationAdapter,
  ConsentState,
  DebugEntry,
  DebugOptions,
  DebugTopic,
  ConsentStorageAdapter,
  EcommerceItem,
  ErrorContext,
  EventName,
  EventParams,
  IdentityStorageAdapter,
  LazyBootConfig,
  LazyBootMode,
  LoadTiming,
  PageEvent,
  PageViewPayload,
  PluginContext,
  Register,
  ProviderConsentRequirement,
  ServerEvent,
  StandardEvents,
  TrackEventOptions,
  UserIdentity,
  UserTraits,
} from './core/types'
