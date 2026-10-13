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
  userId?: string
  email?: string
  phone?: string
}

export type UserTraits = Record<string, unknown> & {
  email?: string
  phone?: string
}

export type ConsentChangeSource =
  | 'bootstrap'
  | 'storage'
  | 'adapter'
  | 'imperative'
  | 'unknown'

export type ConsentBroadcastConfig = {
  eventName?: string | string[]
  globalKey?: string | string[]
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

export type AutoTrackingClickMode = 'all' | 'attribute'

export type AutoTrackingClickConfig = {
  mode?: AutoTrackingClickMode
  attribute?: string
  selectors?: string[]
}

export type AutoTrackingScrollConfig = {
  thresholds?: number[]
}

export type AutoTrackingTimeConfig = {
  intervals?: number[]
}

export type AutoTrackingConfig = {
  clicks?: boolean | AutoTrackingClickConfig
  scroll?: boolean | AutoTrackingScrollConfig
  timeOnPage?: boolean | AutoTrackingTimeConfig
  pageViews?: boolean
}

export type PageViewPayload = {
  url?: string
  path?: string
  title?: string
}

export type TrackEventOptions = {
  requireAnalyticsConsent?: boolean
  requireMarketingConsent?: boolean
  /** Send only to these provider ids. */
  only?: string[]
  /** Shared by browser and server so providers can dedupe. Generated if omitted. */
  eventId?: string
  /** Extra params merged into what a single provider sends, keyed by provider id. */
  providers?: Record<string, Record<string, unknown>>
}

export type AnalyticsEventPayload = {
  id: string
  name: string
  params: Record<string, unknown>
  options: TrackEventOptions
}

export type EcommerceItem = {
  item_id: string
  item_name?: string
  item_variant?: string
  item_brand?: string
  item_category?: string
  price?: number
  quantity?: number
  discount?: number
  coupon?: string
}

type Money = { value?: number; currency?: string }
type EcommerceParams = Money & { items?: EcommerceItem[] }

/** Standard events every provider translates, named after GA4's. Any other name is sent as a custom event. */
export interface StandardEvents {
  sign_up: { method?: string }
  login: { method?: string }
  search: { search_term: string }
  lead: Money
  share: { method?: string; content_type?: string; item_id?: string }
  contact: { method?: string }
  view_item: EcommerceParams
  view_item_list: EcommerceParams & { item_list_id?: string; item_list_name?: string }
  add_to_cart: EcommerceParams
  remove_from_cart: EcommerceParams
  add_to_wishlist: EcommerceParams
  begin_checkout: EcommerceParams & { coupon?: string }
  add_payment_info: EcommerceParams & { payment_type?: string }
  add_shipping_info: EcommerceParams & { shipping_tier?: string }
  purchase: EcommerceParams & {
    transaction_id: string
    tax?: number
    shipping?: number
    coupon?: string
  }
  refund: EcommerceParams & { transaction_id: string }
  trial_started: Money & { plan?: string }
  subscription_started: Money & { plan?: string }
  subscription_cancelled: { plan?: string; reason?: string }
}

export type EventParams<Name extends string> = Name extends keyof StandardEvents
  ? StandardEvents[Name] & Record<string, unknown>
  : Record<string, unknown>

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
  | 'provider-identify'
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
  /** Starts once analytics consent is granted. `true` turns everything on; off by default. */
  autoTracking?: AutoTrackingConfig | boolean
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
  identify?(
    identity: UserIdentity,
    traits: UserTraits,
    context: AnalyticsProviderContext,
  ): Promise<void> | void
  reset?(context: AnalyticsProviderContext): Promise<void> | void
  group?(
    groupId: string,
    traits: Record<string, unknown>,
    context: AnalyticsProviderContext,
  ): Promise<void> | void
}

export interface AnalyticsManager {
  boot: () => Promise<void>
  registerProvider: (provider: ProviderAdapter) => () => void
  updateConsent: (consent: ConsentState | null) => Promise<void>
  getConsent: () => ConsentState | null
  page: (payload?: PageViewPayload) => Promise<void>
  track: <Name extends string>(
    name: Name,
    params?: EventParams<Name>,
    options?: TrackEventOptions,
  ) => Promise<void>
  identify: (userId?: string, traits?: UserTraits) => Promise<void>
  reset: () => Promise<void>
  group: (groupId: string, traits?: Record<string, unknown>) => Promise<void>
  enableAutoTracking: (config?: AutoTrackingConfig) => void
  newPageSession: () => void
  getSnapshot: () => AnalyticsManagerStateSnapshot
  subscribe: (listener: (snapshot: AnalyticsManagerStateSnapshot) => void) => () => void
  destroy: () => void
}

export type ConsentApi = ConsentEngine & {
  /** Merges into the current consent; categories left out stay as they are (denied if unset). */
  update(partial: Partial<ConsentState>): Promise<void>
}

export type Analytics = Omit<
  AnalyticsManager,
  'updateConsent' | 'getConsent' | 'enableAutoTracking'
> & {
  consent: ConsentApi
}
