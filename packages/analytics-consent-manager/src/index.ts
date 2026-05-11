export { createAnalyticsManager } from './core/analytics-manager'
export { createConsentEngine } from './core/consent-engine'
export {
  enableAutoTracking,
  getDefaultConsentEngine,
  getDefaultRuntimeAnalyticsManager,
  newPageSession,
  registerProvider,
  setDefaultConsentEngine,
  setDefaultRuntimeAnalyticsManager,
  trackEvent,
  trackPage,
  updateConsent,
} from './core/default-runtime'
export {
  getDefaultIdentityStorage,
  getIdentity,
  saveIdentity,
  setDefaultIdentityStorage,
  useDefaultIdentityStorage,
} from './core/identity'
export {
  createEnvConfig,
  defaultRuntimePreset,
} from './core/presets'
export {
  createLocalStorageConsentStorage,
  createLocalStorageIdentityStorage,
  createMemoryConsentStorage,
  createMemoryIdentityStorage,
} from './core/storage'
export {
  assertHttpsOrRelativeUrl,
  assertValidGa4MeasurementId,
  assertValidMetaPixelId,
  isHttpsOrRelativeUrl,
  isValidEmail,
  isValidGa4MeasurementId,
  isValidMetaPixelId,
  isValidPhoneE164,
} from './core/validation'
export type {
  AnalyticsError,
  AnalyticsErrorHandler,
  AnalyticsErrorScope,
  AnalyticsEventPayload,
  AnalyticsManager,
  AnalyticsManagerOptions,
  AnalyticsManagerStateSnapshot,
  AnalyticsProviderContext,
  ConsentBroadcastConfig,
  ConsentChangeSource,
  ConsentEngine,
  ConsentEngineOptions,
  ConsentEngineSnapshot,
  ConsentIntegrationAdapter,
  ConsentState,
  ConsentStorageAdapter,
  IdentityStorageAdapter,
  LazyBootConfig,
  LazyBootMode,
  PageViewPayload,
  ProviderAdapter,
  ProviderConsentRequirement,
  TrackEventOptions,
  UserIdentity,
} from './core/types'
export {
  trackAddPaymentInfo,
  trackAddToCart,
  trackAddToWishlist,
  trackContact,
  trackCustomizeProduct,
  trackInitiateCheckout,
  trackLead,
  trackPurchase,
  trackSearch,
  trackSubscribe,
  trackViewContent,
} from './ecommerce-events'
