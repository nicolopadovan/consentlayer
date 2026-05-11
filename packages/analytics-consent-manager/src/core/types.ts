export type ConsentState = {
  preferences: boolean
  analytics: boolean
  marketing: boolean
  sale_of_data?: boolean
}

export type ProviderConsentRequirement =
  | keyof ConsentState
  | ((consent: ConsentState | null) => boolean)

export type UserIdentity = {
  email?: string
  phone?: string
  external_id?: string
}

export type ConsentChangeSource =
  | 'bootstrap'
  | 'storage'
  | 'adapter'
  | 'imperative'
  | 'unknown'

export type ConsentBroadcastConfig = {
  eventName?: string
  globalKey?: string
  document?: Document
  window?: Window
}

export interface ConsentStorageAdapter {
  read(): ConsentState | null
  write(consent: ConsentState | null): void
  subscribe?(listener: () => void): () => void
  clear?(): void
}

export interface IdentityStorageAdapter {
  read(): UserIdentity
  write(identity: Partial<UserIdentity>): void
  clear?(): void
}

export interface ConsentIntegrationAdapter {
  id: string
  bootstrap?(): Promise<ConsentState | null> | ConsentState | null
  apply?(consent: ConsentState): Promise<void> | void
  subscribe?(
    onConsent: (consent: ConsentState) => void,
  ): (() => void) | void
}

export type ConsentEngineOptions = {
  storage?: ConsentStorageAdapter
  adapters?: ConsentIntegrationAdapter[]
  initialConsent?: ConsentState | null
  broadcast?: ConsentBroadcastConfig
  debug?: boolean
}

export type ConsentEngineSnapshot = {
  consent: ConsentState | null
}

export interface ConsentEngine {
  bootstrap(): Promise<ConsentState | null>
  getConsent(): ConsentState | null
  setConsent(consent: ConsentState, source?: ConsentChangeSource): Promise<void>
  subscribe(listener: (snapshot: ConsentEngineSnapshot) => void): () => void
  destroy(): void
}

export type LazyBootMode = 'immediate' | 'idle' | 'manual'

export type LazyBootConfig = {
  mode?: LazyBootMode
  timeoutMs?: number
}

export type PageViewPayload = {
  url?: string
  path?: string
  title?: string
}

export type TrackEventOptions = {
  requireAnalyticsConsent?: boolean
  requireMarketingConsent?: boolean
  sendTo?: string[]
  eventId?: string
}

export type AnalyticsEventPayload = {
  name: string
  params: Record<string, unknown>
  options: TrackEventOptions
}

export type AnalyticsManagerStateSnapshot = {
  booted: boolean
  consent: ConsentState | null
  activeProviders: string[]
}

export type AnalyticsErrorScope =
  | 'provider-setup'
  | 'provider-init'
  | 'provider-teardown'
  | 'provider-consent-change'
  | 'provider-track-event'
  | 'provider-track-page'
  | 'provider-script-load'
  | 'identity-validation'

export type AnalyticsError = {
  scope: AnalyticsErrorScope
  providerId?: string
  message: string
  cause?: unknown
}

export type AnalyticsErrorHandler = (error: AnalyticsError) => void

export type AnalyticsManagerOptions = {
  providers?: ProviderAdapter[]
  consent?: ConsentState | null
  consentEngine?: ConsentEngine
  identityStorage?: IdentityStorageAdapter
  enabled?: boolean | (() => boolean)
  debug?: boolean
  lazy?: LazyBootConfig
  defaultEventDestinations?: string[]
  onError?: AnalyticsErrorHandler
}

export type AnalyticsProviderContext = {
  consent: ConsentState | null
  identity: UserIdentity
  debug: boolean
  isBooted: boolean
  emitError: AnalyticsErrorHandler
}

export interface ProviderAdapter {
  id: string
  requiredConsent?: ProviderConsentRequirement
  enabled?(context: AnalyticsProviderContext): boolean
  setup?(context: AnalyticsProviderContext): Promise<void> | void
  init?(context: AnalyticsProviderContext): Promise<void> | void
  teardown?(context: AnalyticsProviderContext): Promise<void> | void
  onConsentChange?(context: AnalyticsProviderContext): Promise<void> | void
  trackPage?(
    payload: PageViewPayload,
    context: AnalyticsProviderContext,
  ): Promise<void> | void
  trackEvent?(
    event: AnalyticsEventPayload,
    context: AnalyticsProviderContext,
  ): Promise<void> | void
}

export interface AnalyticsManager {
  boot(): Promise<void>
  registerProvider(provider: ProviderAdapter): () => void
  updateConsent(consent: ConsentState | null): Promise<void>
  getConsent(): ConsentState | null
  trackPage(payload?: PageViewPayload): Promise<void>
  trackEvent(
    name: string,
    params?: Record<string, unknown>,
    options?: TrackEventOptions,
  ): Promise<void>
  enableAutoTracking(): void
  newPageSession(): void
  getSnapshot(): AnalyticsManagerStateSnapshot
  subscribe(listener: (snapshot: AnalyticsManagerStateSnapshot) => void): () => void
  destroy(): void
}
