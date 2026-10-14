/**
 * Your own consent categories. Declare them here and pass them to `createAnalytics({ categories })`:
 * `declare module 'consentlayer' { interface ConsentCategories { functional: true } }`
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ConsentCategories {}

/** A category the visitor can toggle: the built-in ones plus yours. */
export type ConsentCategory = keyof ({ preferences: true; analytics: true; marketing: true } & ConsentCategories)

/** Consent per category. Necessary cookies are always allowed, so they have no flag. */
export type ConsentState = Record<ConsentCategory, boolean> & {
  sale_of_data?: boolean
}

/** What a plugin needs before it runs: a category, `'none'`, or a custom check. */
export type ProviderConsentRequirement = keyof ConsentState | 'none' | ((consent: ConsentState | null) => boolean)

/** Who the visitor is, once known. Stored only with analytics or marketing consent. */
export type UserIdentity = {
  userId?: string
  email?: string
  phone?: string
}

/** Extra traits passed to `identify`; `email` and `phone` also update the identity. */
export type UserTraits = Record<string, unknown> & {
  email?: string
  phone?: string
}

/** Where a consent change came from. */
export type ConsentChangeSource = 'bootstrap' | 'storage' | 'adapter' | 'imperative' | 'unknown'

/** DOM event names and window globals that announce consent changes to other scripts. */
export type ConsentBroadcastConfig = {
  eventName?: string | string[]
  globalKey?: string | string[]
  document?: Document
  window?: Window
}

/** Where consent is kept. Defaults to localStorage. */
/** A stored choice: the consent, when it was made (epoch ms) and under which `policyVersion`. */
export type StoredConsent = {
  consent: ConsentState
  updatedAt?: number
  policyVersion?: string
}

export interface ConsentStorageAdapter {
  read(): StoredConsent | null
  write(record: StoredConsent | null): void
  subscribe?(listener: () => void): () => void
  clear?(): void
}

/** Where the visitor identity is kept. Defaults to localStorage. */
export interface IdentityStorageAdapter {
  read(): UserIdentity
  write(identity: Partial<UserIdentity>): void
  clear?(): void
}

export type ConsentBootstrapAnswer = ConsentState | { consent: ConsentState; provisional: true } | null

/** Syncs consent with an outside consent platform: reads its choice at boot, pushes changes to it, and listens for its updates. */
export interface ConsentIntegrationAdapter {
  id: string
  /** Its bootstrap answer replaces the stored choice, which is used only when it answers `null` or fails. */
  authoritative?: boolean
  /** Answers `{ consent, provisional: true }` for a state the visitor has not chosen yet: it applies but is not stored. */
  bootstrap?(): Promise<ConsentBootstrapAnswer> | ConsentBootstrapAnswer
  apply?(consent: ConsentState): Promise<void> | void
  subscribe?(onConsent: (consent: ConsentState) => void): (() => void) | void
  /** Runs when the engine is created and after every consent change, whatever its source. */
  observe?(consent: ConsentState | null): void
}

export type ConsentEngineOptions = {
  storage?: ConsentStorageAdapter
  adapters?: ConsentIntegrationAdapter[]
  initialConsent?: ConsentState | null
  /** Your own categories, on top of preferences, analytics and marketing. */
  categories?: (keyof ConsentCategories)[]
  broadcast?: ConsentBroadcastConfig
  /** A stored choice older than this many days is stale. Unset, never. */
  maxAgeDays?: number
  /** A stored choice made under another major version (the part before the first `.`), or none, is stale. Unset, never. */
  policyVersion?: string
  /** `'discard'` treats a stale choice as no choice; `'keep'` keeps it in force until the visitor chooses again. Either way the banner shows. */
  onStale?: 'discard' | 'keep'
  /** Honor the browser's Global Privacy Control signal: "accept all" leaves marketing off while it is on. Defaults to `true`. */
  gpc?: boolean
  debug?: boolean | DebugOptions
  onError?: AnalyticsErrorHandler
}

/** What consent subscribers receive. */
export type ConsentEngineSnapshot = {
  consent: ConsentState | null
}

export interface ConsentEngine {
  /** Every category the visitor can toggle, built-in first. */
  categories: readonly ConsentCategory[]
  /** Whether the browser sends the Global Privacy Control signal and the `gpc` option honors it. */
  gpc: boolean
  bootstrap: () => Promise<ConsentState | null>
  getConsent: () => ConsentState | null
  /** Whether the stored choice is stale and the visitor should be asked again. */
  isStale: () => boolean
  setConsent: (consent: ConsentState, source?: ConsentChangeSource) => Promise<void>
  subscribe: (listener: (snapshot: ConsentEngineSnapshot) => void) => () => void
  destroy: () => void
}

/** When providers load: right away, when the browser is idle, or when you call `analytics.boot()`. */
export type LazyBootMode = 'immediate' | 'idle' | 'manual'

/** When providers load, and how long to wait for idle time. */
export type LazyBootConfig = {
  mode?: LazyBootMode
  timeoutMs?: number
}

/** `'all'` tracks clicks on elements matching `selectors`; `'attribute'` only elements with the tracking attribute. */
export type AutoTrackingClickMode = 'all' | 'attribute'

/** Which clicks are tracked automatically. */
export type AutoTrackingClickConfig = {
  mode?: AutoTrackingClickMode
  attribute?: string
  selectors?: string[]
}

/** Scroll depths (percent) that send an event. */
export type AutoTrackingScrollConfig = {
  thresholds?: number[]
}

/** Seconds on page that send an event. */
export type AutoTrackingTimeConfig = {
  intervals?: number[]
}

/** Events tracked without code. `true` uses the defaults for that kind. */
export type AutoTrackingConfig = {
  clicks?: boolean | AutoTrackingClickConfig
  scroll?: boolean | AutoTrackingScrollConfig
  timeOnPage?: boolean | AutoTrackingTimeConfig
  pageViews?: boolean
}

/** What `autoTracking()` returns: started once with `track` and a signal aborted on `destroy()`, it returns the function that starts a page session. */
export type AutoTracking = (context: {
  track: (name: string, params: Record<string, unknown>, options: TrackEventOptions) => Promise<void>
  signal: AbortSignal
}) => () => void

/** Page view details; read from `location` and `document.title` when omitted. */
export type PageViewPayload = {
  url?: string
  path?: string
  title?: string
}

/** Per-event options for `track`. */
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

/** An event as plugins receive it. */
export type AnalyticsEventPayload = {
  id: string
  name: string
  params: Record<string, unknown>
  options: TrackEventOptions
}

/** A product line in GA4 item format. */
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

/**
 * Declares your own events, which types their params and makes `track` reject undeclared names:
 * `declare module 'consentlayer' { interface Register { events: { quote_requested: { value: number } } } }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Register {}

type RegisteredEvents = Register extends { events: infer Events } ? Events : Record<never, never>

/** Any name until events are declared in `Register`; then the standard, declared and auto-tracking events. */
export type EventName = Register extends { events: infer Events }
  ? | keyof StandardEvents
    | (keyof Events & string)
    | `${string}.${'page_session_start' | 'scroll_depth' | 'time_on_page' | 'ui_click'}`
  : keyof StandardEvents | (string & {})

/** Params for an event: typed for the standard and declared events, free-form for the rest. */
export type EventParams<Name extends string> = Name extends keyof StandardEvents
  ? StandardEvents[Name] & Record<string, unknown>
  : Name extends keyof RegisteredEvents
    ? RegisteredEvents[Name]
    : Record<string, unknown>

/** What `analytics.subscribe` listeners receive. */
export type AnalyticsManagerStateSnapshot = {
  booted: boolean
  consent: ConsentState | null
  activeProviders: string[]
}

/** Which step failed. */
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
  | 'auto-tracking'
  | 'queue-full'

/** A failure inside a provider, the server forward or a consent adapter, or a full call queue. Never thrown; passed to `onError`. */
export type AnalyticsError = {
  scope: AnalyticsErrorScope
  providerId?: string
  message: string
  cause?: unknown
}

/** `consent`: changes and stale choices. `events`: page views, `track`, `identify`, `group` and `reset`, per provider. `providers`: boot and each provider's setup, consent, load and teardown. `errors`: `AnalyticsError`s and `captureError` deliveries. */
export type DebugTopic = 'consent' | 'events' | 'providers' | 'errors'

export type DebugEntry = { topic: DebugTopic; provider?: string; message: string; data: unknown[] }

/** Topics set to `true` are logged; with none set to `true`, every topic not set to `false` is. */
export type DebugOptions = Partial<Record<DebugTopic, boolean>> & {
  /** Drops entries about other providers. Entries about no provider are kept. */
  only?: string[]
  /** Receives each entry instead of `console.debug`. */
  logger?: (entry: DebugEntry) => void
}

/** Receives every `AnalyticsError`. */
export type AnalyticsErrorHandler = (error: AnalyticsError) => void

export type AnalyticsManagerOptions = {
  providers?: AnalyticsPlugin[]
  consent?: ConsentState | null
  consentEngine?: ConsentEngine
  identityStorage?: IdentityStorageAdapter
  enabled?: boolean | (() => boolean)
  debug?: boolean | DebugOptions
  /** `autoTracking()` from `consentlayer/auto-tracking`. Starts once analytics consent is granted; off by default. */
  autoTracking?: AutoTracking
  onError?: AnalyticsErrorHandler
  /**
   * `captureError` and the window `error` / `unhandledrejection` handlers.
   * `false` turns both off; `{ globalHandlers: false }` keeps only `captureError`.
   */
  errors?: boolean | { globalHandlers?: boolean }
  /** Set on every `<script>` ConsentLayer injects, for a Content Security Policy that allows scripts by nonce. */
  nonce?: string
  /** HTTPS URLs or paths starting with "/". */
  server?: {
    /** Also send each event to this route (see `createAnalyticsHandler`). */
    endpoint?: string
    /** Post each consent choice to this route (see `createConsentHandler`). */
    consentEndpoint?: string
  }
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
  /** Send only to destinations whose `requiredConsent` is one of these. */
  categories?: (keyof ConsentState)[]
  providers?: Record<string, Record<string, unknown>>
}

/** What plugins receive on each call. */
export type PluginContext = {
  consent: ConsentState | null
  identity: UserIdentity
  /** Whether the `debug` option is on. */
  debug: boolean
  /** Logs under the `providers` debug topic, attributed to this plugin. */
  log: (message: string, ...data: unknown[]) => void
  emitError: AnalyticsErrorHandler
}

/** A page view as plugins receive it. */
export type PageEvent = PageViewPayload & {
  /** Shared by browser and server so providers can dedupe. */
  id: string
}

/** Extra details for `captureError`. */
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

type Hook<Args extends unknown[] = []> = (...args: [...Args, PluginContext]) => Promise<void> | void

/**
 * A provider. The manager decides when each hook runs:
 * `setup` when the instance is created in the browser, or else at boot;
 * `load` once, when `requiredConsent` is granted (at boot
 * with `loadBeforeConsent`, or when there is no `load`); then `consent` on
 * every consent change. `page`, `track`, `identify` and `group` run only
 * while consent is granted; a withdrawal runs `teardown`. Errors go to
 * `onError` and never reach other plugins.
 */
export interface AnalyticsPlugin {
  id: string
  /** The consent the provider needs. `'none'` runs it without consent. */
  requiredConsent: ProviderConsentRequirement
  /** Load before consent and rely on the provider's own consent mode. */
  loadBeforeConsent?: boolean
  defer?: LoadTiming
  /** Event names `track` sends to it: all when unset, none with `false`. An event whose `only` names it is always sent. */
  events?: readonly string[] | false
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
  /**
   * `only` limits which providers and server destinations receive it; `server: true` ignores it for the server, `false` skips the server.
   * An array of categories ignores `only` for the server and sends to the destinations that require one of them.
   */
  page: (
    payload?: PageViewPayload,
    options?: { only?: string[]; server?: boolean | (keyof ConsentState)[] },
  ) => Promise<void>
  track: <Name extends EventName>(name: Name, params?: EventParams<Name>, options?: TrackEventOptions) => Promise<void>
  identify: (userId?: string, traits?: UserTraits) => Promise<void>
  reset: () => Promise<void>
  group: (groupId: string, traits?: Record<string, unknown>) => Promise<void>
  captureError: (error: unknown, context?: ErrorContext) => Promise<void>
  newPageSession: () => void
  getSnapshot: () => AnalyticsManagerStateSnapshot
  subscribe: (listener: (snapshot: AnalyticsManagerStateSnapshot) => void) => () => void
  destroy: () => void
}

/** Reads and changes consent: `analytics.consent`. */
export type ConsentApi = Omit<ConsentEngine, 'destroy'> & {
  /** Merges into the current consent; categories left out stay as they are (denied if unset). */
  update(partial: Partial<ConsentState>): Promise<void>
}

/** The instance `createAnalytics` returns. */
export type Analytics = Omit<AnalyticsManager, 'updateConsent' | 'getConsent'> & {
  consent: ConsentApi
}
