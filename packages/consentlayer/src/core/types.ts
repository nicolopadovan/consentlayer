export type ConsentState = {
  preferences: boolean
  analytics: boolean
  marketing: boolean
  sale_of_data?: boolean
}

export type ProviderConsentRequirement =
  | keyof ConsentState
  | 'none'
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
  onError?: AnalyticsErrorHandler
}

export type ConsentEngineSnapshot = {
  consent: ConsentState | null
}

export interface ConsentEngine {
  bootstrap: () => Promise<ConsentState | null>
  getConsent: () => ConsentState | null
  setConsent: (consent: ConsentState, source?: ConsentChangeSource) => Promise<void>
  subscribe: (listener: (snapshot: ConsentEngineSnapshot) => void) => () => void
  destroy: () => void
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
  /** Send auto-tracked events only to these provider ids. Defaults to all. */
  only?: string[]
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
  | 'provider-load'
  | 'provider-consent'
  | 'provider-page'
  | 'provider-track'
  | 'provider-identify'
  | 'provider-error'
  | 'provider-teardown'
  | 'provider-script-load'
  | 'server-forward'
  | 'consent-adapter'

export type AnalyticsError = {
  scope: AnalyticsErrorScope
  providerId?: string
  message: string
  cause?: unknown
}

export type AnalyticsErrorHandler = (error: AnalyticsError) => void

export type AnalyticsManagerOptions = {
  providers?: AnalyticsPlugin[]
  consent?: ConsentState | null
  consentEngine?: ConsentEngine
  identityStorage?: IdentityStorageAdapter
  enabled?: boolean | (() => boolean)
  debug?: boolean
  /** Starts once analytics consent is granted. `true` turns everything on; off by default. */
  autoTracking?: AutoTrackingConfig | boolean
  onError?: AnalyticsErrorHandler
  /**
   * `captureError` and the window `error` / `unhandledrejection` handlers.
   * `false` turns both off; `{ globalHandlers: false }` keeps only `captureError`.
   */
  errors?: boolean | { globalHandlers?: boolean }
  /** Also send each event to this route (see `createAnalyticsHandler`). HTTPS URL or a path starting with "/". */
  server?: { endpoint: string }
}

/** What the browser sends to the server, and what `sendServerEvent` takes. */
export type ServerEvent = {
  /** Shared with the browser event so destinations can dedupe. */
  id?: string
  name: string
  params?: Record<string, unknown>
  /** The consent the event was collected under. */
  consent: ConsentState
  identity?: UserIdentity
  url?: string
  /** GA4 client ID; read from the `_ga` cookie when omitted. */
  clientId?: string
  only?: string[]
  providers?: Record<string, Record<string, unknown>>
}

export type PluginContext = {
  consent: ConsentState | null
  identity: UserIdentity
  debug: boolean
  emitError: AnalyticsErrorHandler
}

export type PageEvent = PageViewPayload & {
  /** Shared by browser and server so providers can dedupe. */
  id: string
}

export type ErrorContext = {
  level?: 'fatal' | 'error' | 'warning'
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  /** Where it was caught. */
  source?: 'manual' | 'global' | 'boundary'
}

/**
 * When `load` runs once consent allows it: right away (default), when the
 * browser is idle, on the first interaction, or after a delay in ms. Calls made
 * meanwhile are held (up to 100) and delivered after `load`.
 */
export type LoadTiming = false | 'idle' | 'interaction' | number

type Hook<Args extends unknown[] = []> = (
  ...args: [...Args, PluginContext]
) => Promise<void> | void

/**
 * A provider. The manager decides when each hook runs:
 * `setup` at boot; `load` once, when `requiredConsent` is granted (at boot
 * with `loadBeforeConsent`, or when there is no `load`); then `consent` on
 * every consent change. `page`, `track`, `identify` and `group` run only
 * while consent is granted; a withdrawal runs `teardown`. Errors go to
 * `onError` and never reach other plugins.
 */
export interface AnalyticsPlugin {
  id: string
  /** Defaults to `'none'`. */
  requiredConsent?: ProviderConsentRequirement
  /** Load before consent and rely on the provider's own consent mode. */
  loadBeforeConsent?: boolean
  defer?: LoadTiming
  /** No network, no cookies. */
  setup?: Hook
  /** Inject scripts. Runs once. */
  load?: Hook
  /** Apply the current consent state. */
  consent?: Hook
  page?: Hook<[page: PageEvent]>
  track?: Hook<[event: AnalyticsEventPayload]>
  identify?: Hook<[identity: UserIdentity, traits: UserTraits]>
  reset?: Hook
  group?: Hook<[groupId: string, traits: Record<string, unknown>]>
  /** Receives errors from `captureError` and the global handlers. */
  error?: Hook<[error: unknown, context: ErrorContext]>
  /** Stop sending; remove cookies where possible. */
  teardown?: Hook
}

export interface AnalyticsManager {
  boot: () => Promise<void>
  registerProvider: (provider: AnalyticsPlugin) => () => void
  updateConsent: (consent: ConsentState | null) => Promise<void>
  getConsent: () => ConsentState | null
  /** `only` limits which providers receive it. */
  page: (payload?: PageViewPayload, options?: { only?: string[] }) => Promise<void>
  track: <Name extends string>(
    name: Name,
    params?: EventParams<Name>,
    options?: TrackEventOptions,
  ) => Promise<void>
  identify: (userId?: string, traits?: UserTraits) => Promise<void>
  reset: () => Promise<void>
  group: (groupId: string, traits?: Record<string, unknown>) => Promise<void>
  captureError: (error: unknown, context?: ErrorContext) => Promise<void>
  enableAutoTracking: (config?: AutoTrackingConfig) => void
  newPageSession: () => void
  getSnapshot: () => AnalyticsManagerStateSnapshot
  subscribe: (listener: (snapshot: AnalyticsManagerStateSnapshot) => void) => () => void
  destroy: () => void
}

export type ConsentApi = Omit<ConsentEngine, 'destroy'> & {
  /** Merges into the current consent; categories left out stay as they are (denied if unset). */
  update(partial: Partial<ConsentState>): Promise<void>
}

export type Analytics = Omit<
  AnalyticsManager,
  'updateConsent' | 'getConsent' | 'enableAutoTracking'
> & {
  consent: ConsentApi
  /** Default consent UI language passed to `createAnalytics`. */
  locale?: string
}
