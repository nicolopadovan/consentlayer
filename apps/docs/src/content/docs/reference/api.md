---
title: API reference
description: Every export of ConsentLayer, grouped by entry point, with its signature, options, return value and errors.
---

This page lists every export ConsentLayer ships, grouped by entry point. Each
entry gives the signature, the options with their types and defaults, the
return value and the errors it throws. Options are optional unless marked
**Required**. The guides explain when to use each part.

| Entry point | Exports |
|---|---|
| [`consentlayer`](#consentlayer) | `createAnalytics`, `createConsentController`, `definePlugin`, `loadScript`, `getFlag`, `setFlag`, `getNames`, storage adapters, core types |
| [`consentlayer/react`](#consentlayerreact) | `AnalyticsProvider`, `useAnalytics`, `useConsent`, `useConsentController`, `ErrorBoundary`, `createGlobalError`, `MetaPixelNoscript` |
| [`consentlayer/next`](#consentlayernext) | `AnalyticsProvider` for Next.js |
| [`consentlayer/vue`](#consentlayervue) | `consentLayer`, `useAnalytics`, `useConsent`, `useConsentController`, `MetaPixelNoscript` |
| [`consentlayer/nuxt`](#consentlayernuxt) | The Nuxt module, which auto-imports `defineConsentLayerConfig` |
| [`consentlayer/svelte`](#consentlayersvelte) | `consentLayer`, `useAnalytics`, `useConsent`, `useConsentController`, `MetaPixelNoscript` |
| [`consentlayer/sveltekit`](#consentlayersveltekit) | `consentLayer`, `handleErrorWith`, and the rest of `consentlayer/svelte` |
| [`consentlayer/solid`](#consentlayersolid) | `AnalyticsProvider`, `useAnalytics`, `useConsent`, `useConsentController`, `ErrorBoundary`, `MetaPixelNoscript` |
| [`consentlayer/solidstart`](#consentlayersolidstart) | `AnalyticsProvider` for Solid Router, and the rest of `consentlayer/solid` |
| [`consentlayer/angular`](#consentlayerangular) | `provideConsentLayer`, `injectAnalytics`, `injectConsent`, `injectConsentController`, `provideMetaPixelNoscript` |
| [`consentlayer/providers/*`](#consentlayerproviders) | `ga4`, `meta`, `posthog`, `sentry`, `contentsquare`, `hotjar`, `vercel`, `tiktok`, the Shopify consent adapter |
| [`consentlayer/ecommerce`](#consentlayerecommerce) | `productParams`, `cartParams`, `orderParams`, `toItem` |
| [`consentlayer/server`](#consentlayerserver) | `createAnalyticsHandler`, `sendServerEvent`, `createConsentHandler`, `readConsentCookie`, `requestInfo`, consent stores |
| [`consentlayer/server/meta`](#consentlayerservermeta) | `metaCapi` |
| [`consentlayer/server/tiktok`](#consentlayerservertiktok) | `tiktokEvents` |
| [`consentlayer/server/ga4`](#consentlayerserverga4) | `ga4Server` |
| [`consentlayer/sentry/server`](#consentlayersentryserver) | `sentryInstrumentation` |
| [`consentlayer/sentry/next`](#consentlayersentrynext) | `withSentryConfig` |
| [`consentlayer/testing`](#consentlayertesting) | `checkPlugin` |

## `consentlayer`

### `createAnalytics(options)`

Creates the analytics instance. Nothing loads until `boot()` is called, and
then only the providers that consent allows. Create one instance per page.

```ts
import { createAnalytics } from 'consentlayer'

function createAnalytics(options?: AnalyticsOptions): Analytics
```

| Option | Type | Default | Description |
|---|---|---|---|
| `providers` | `AnalyticsPlugin[]` | `[]` | The providers to run. See [Providers](/guides/providers/). |
| `categories` | `(keyof ConsentCategories)[]` | `[]` | Custom consent categories, added after `preferences`, `analytics` and `marketing`. See [Custom categories](#custom-categories). |
| `consent` | [`ConsentOptions`](#consent-options) | | Consent storage, adapters and broadcast. |
| `names` | [`NamesInput`](#names) | | Storage keys, globals and DOM event names. See [Names](/guides/names/). |
| `autoTracking` | `boolean \| AutoTrackingConfig` | `false` | Automatic page session, click, scroll and time-on-page events. See [`autoTracking`](#autotracking). |
| `server` | `{ endpoint?: string; consentEndpoint?: string }` | | Server routes. See [`server`](#server). |
| `errors` | `boolean \| { globalHandlers?: boolean }` | `true` | `false` disables `captureError` and the global handlers. `{ globalHandlers: false }` keeps `captureError` but does not listen to the window's `error` and `unhandledrejection` events. |
| `enabled` | `boolean \| (() => boolean)` | `true` | When `false`, or when the function returns `false`, no provider runs and calls are dropped. The function is evaluated on every call. |
| `debug` | `boolean \| DebugOptions` | `false` | Logs what ConsentLayer does. See [`debug`](#debug). |
| `onError` | `(error: AnalyticsError) => void` | | Receives every [`AnalyticsError`](#analyticserror), including consent adapter errors. Exceptions it throws are swallowed. |
| `identityStorage` | `IdentityStorageAdapter` | `localStorage`, under `names.identityStorageKey` | Where the user identity is kept. |

**Returns** an [`Analytics`](#the-analytics-instance) instance.

**Throws** an `Error` when `server.endpoint` or `server.consentEndpoint` is
neither an `https:` URL nor a path that starts with a single `/`.

Calling `createAnalytics()` again with different `names` logs a warning: names
apply to the whole page, so the last call's names win.

<details>
<summary>Type signature</summary>

```ts
type AnalyticsOptions = {
  providers?: AnalyticsPlugin[]
  identityStorage?: IdentityStorageAdapter
  enabled?: boolean | (() => boolean)
  debug?: boolean | DebugOptions
  autoTracking?: AutoTrackingConfig | boolean
  onError?: AnalyticsErrorHandler
  errors?: boolean | { globalHandlers?: boolean }
  server?: {
    endpoint?: string
    consentEndpoint?: string
  }
  consent?: {
    storage?: ConsentStorageAdapter
    adapters?: ConsentIntegrationAdapter[]
    initialConsent?: ConsentState | null
    categories?: (keyof ConsentCategories)[]
    broadcast?: ConsentBroadcastConfig
    maxAgeDays?: number
    policyVersion?: string
    onStale?: 'discard' | 'keep'
  }
  categories?: (keyof ConsentCategories)[]
  names?: NamesInput
}
```

</details>

#### Consent options

`createAnalytics({ consent: { … } })`:

| Option | Type | Default | Description |
|---|---|---|---|
| `storage` | `ConsentStorageAdapter` | `localStorage`, under `names.consentStorageKey` | Where the choice is stored. See [Storage adapters](#storage-adapters). |
| `adapters` | `ConsentIntegrationAdapter[]` | `[]` | External consent platforms to sync with, such as [`createShopifyCustomerPrivacyAdapter()`](#createshopifycustomerprivacyadapteroptions). |
| `initialConsent` | `ConsentState \| null` | `null` | The consent in effect until `bootstrap()` finds a stored choice or an adapter supplies one. |
| `broadcast` | `ConsentBroadcastConfig` | `{ eventName: names.consentEventName, globalKey: names.consentGlobalKey }` | The DOM events and window globals that announce each change. Replaces the default entirely when set. |
| `maxAgeDays` | `number` | None | A stored choice made more than this many days ago is stale, and so is one stored without a date. Must be a positive number; anything else throws `[consentlayer] consent.maxAgeDays must be a positive number, received …`. |
| `policyVersion` | `string` | None | A stored choice made under another major version, the part before the first `.`, or under none, is stale: `'3.1'` to `'3.2'` keeps choices, `'3.2'` to `'4.0'` asks again. Surrounding whitespace is trimmed; `''` counts as unset. Pass the same value as to [`createConsentHandler()`](#createconsenthandleroptions). |
| `onStale` | `'discard' \| 'keep'` | `'discard'` | What a stale choice means until the visitor chooses again. `'discard'` treats it as no choice: consent is `null` and only `'none'` providers run. `'keep'` keeps it in force. Either way the banner is shown. See [Asking again](/guides/consent-ui/#asking-again). |

Custom categories and the error callback are set with the top-level
`categories` and `onError`; passing them inside `consent` is a type error.

<details>
<summary><code>ConsentBroadcastConfig</code></summary>

```ts
type ConsentBroadcastConfig = {
  /** Each name is dispatched on `document` as a CustomEvent whose `detail` is the ConsentState. */
  eventName?: string | string[]
  /** Each key is set on `window` to the ConsentState. */
  globalKey?: string | string[]
  document?: Document
  window?: Window
}
```

</details>

#### `autoTracking`

`true` enables every kind of event with its defaults. An object that turns on
a kind, with `true` or its options, enables only the kinds it turns on. An
object that turns none on, such as `{ scroll: false }` or `{ only: ['ga4'] }`,
enables every kind it does not set to `false`, the same rule as
[`debug`](#debug). Automatic events start after `boot()`, once
analytics consent is granted, and are sent with `requireAnalyticsConsent: true`.
Their names are listed in [Names](/guides/names/).

| Field | Type | Default | Description |
|---|---|---|---|
| `pageViews` | `boolean` | `true` | Sends `pageSessionStart` with `{ session_id }` at the start of each page session. |
| `clicks` | `boolean \| AutoTrackingClickConfig` | enabled | Sends `uiClick` with `{ ui_target, ui_element, ui_id, path, session_id }`. |
| `clicks.mode` | `'all' \| 'attribute'` | `'all'` | `'all'` tracks elements matching `selectors`; `'attribute'` tracks only elements that have `attribute`. |
| `clicks.attribute` | `string` | `'data-track'` | Its value is used as `ui_target`, before `aria-label`, `name` and the first 80 characters of the text. |
| `clicks.selectors` | `string[]` | `['button', '[role="button"]', 'a', 'input[type="submit"]', 'input[type="button"]']` | Elements tracked in `'all'` mode. |
| `scroll` | `boolean \| { thresholds?: number[] }` | `[25, 50, 75, 100]` | Scroll depths, in percent, that each send `scrollDepth` with `{ depth, session_id }` once per page session. `100` fires at 95%. |
| `timeOnPage` | `boolean \| { intervals?: number[] }` | `[5, 15, 30, 60, 120]` | Seconds on the page that each send `timeOnPage` with `{ seconds, session_id }`. |
| `only` | `string[]` | every provider | Sends automatic events only to these provider IDs. |

#### `debug`

`true` logs every topic with `console.debug`, prefixed with `[consentlayer]`.
An object chooses the topics, the providers and where entries go:

```ts
createAnalytics({
  providers,
  debug: { events: true, errors: true, only: ['ga4'] },
})
```

| Topic | Logs |
|---|---|
| `consent` | Each consent change, with its source, and a stored choice found stale. |
| `events` | Each page view, `track`, `identify`, `group` and `reset`, once per provider that receives it, with its payload: `ga4.track sign_up {method: 'email'}`. Also a call that reaches no provider, is held until boot, or is dropped because `enabled` is `false`. |
| `providers` | `boot`, and each provider's `setup`, `consent`, `load` and `teardown`, including `ga4 is off: measurementId is not set.` |
| `errors` | Every [`AnalyticsError`](#analyticserror), and each provider a `captureError` call reaches, or that it reaches none. |

Topics set to `true` are logged. When no topic is `true`, every topic is
logged except those set to `false`, so `{ events: false }` logs everything but
events.

| Field | Type | Description |
|---|---|---|
| `consent`, `events`, `providers`, `errors` | `boolean` | Turns a topic on or off. |
| `only` | `string[]` | Drops entries about providers whose `id` is not listed. Entries about no provider, such as consent changes, are kept. |
| `logger` | `(entry: DebugEntry) => void` | Receives each entry in place of `console.debug`. |

```ts
type DebugEntry = {
  topic: 'consent' | 'events' | 'providers' | 'errors'
  provider?: string
  message: string
  data: unknown[]
}
```

The types are exported as `DebugOptions`, `DebugEntry` and `DebugTopic`.

#### `server`

| Option | Type | Description |
|---|---|---|
| `server.endpoint` | `string` | Also posts every `track` and `page` call, as a [`ServerEvent`](#serverevent), to this route while analytics or marketing consent is granted. Uses `fetch` with `keepalive`, or `navigator.sendBeacon` where `fetch` is missing. Failures are reported with scope `server-forward`. Stops for the page load when the route answers with `consentlayer-forwarding: off`. See [`createAnalyticsHandler`](#createanalyticshandleroptions). |
| `server.consentEndpoint` | `string` | Posts `{ consent }` to this route on every consent change, except a choice read back from storage. Failures are reported with scope `consent-adapter` and provider ID `consent-endpoint`. When the `server.endpoint` route answers `consentlayer-consent: missing`, also posts `{ consent, restored: true }` once per page load; a failure is reported with scope `server-forward`. See [`createConsentHandler`](#createconsenthandleroptions). |

Both must be `https:` URLs or paths starting with `/`. `undefined` or `''`
turns the option off.

### The analytics instance

`createAnalytics()` returns an object of type `Analytics`.

| Member | Signature | Description |
|---|---|---|
| `boot` | `() => Promise<void>` | Installs the global error handlers, starts the providers that consent allows and delivers the calls queued before. Runs once; later calls do nothing. `<AnalyticsProvider>` calls it for you. |
| `track` | `<Name extends string>(name: Name, params?: EventParams<Name>, options?: TrackEventOptions) => Promise<void>` | Sends an event. Params of the [standard events](#standardevents) are typed. See [Events and identity](/guides/events/). |
| `page` | `(payload?: PageViewPayload, options?: { only?: string[] }) => Promise<void>` | Sends a page view. `payload` is merged over `{ url: location.href, path: location.pathname + location.search, title: document.title }`. |
| `identify` | `(userId?: string, traits?: UserTraits) => Promise<void>` | Sets the user ID and traits. A different `userId` replaces the previous identity. See [Identity](#identity). |
| `reset` | `() => Promise<void>` | Forgets the identity, clears identity storage and calls each provider's `reset`. |
| `group` | `(groupId: string, traits?: Record<string, unknown>) => Promise<void>` | Associates the user with a group, such as a company. |
| `captureError` | `(error: unknown, context?: ErrorContext) => Promise<void>` | Sends an error to the providers that implement `error`. `context.source` defaults to `'manual'`. An error object is sent once; later calls with it do nothing. Does nothing when `errors` is `false`. |
| `newPageSession` | `() => void` | Restarts the automatic page session: a new `session_id`, scroll depths and timers. Does nothing until auto-tracking has started. `<AnalyticsProvider>` calls it when `routeKey` changes. |
| `registerProvider` | `(plugin: AnalyticsPlugin) => () => void` | Adds a provider after creation and runs it through the lifecycle if the instance has booted. Returns a function that tears it down and removes it. |
| `getSnapshot` | `() => AnalyticsManagerStateSnapshot` | Returns `{ booted, consent, activeProviders }`. |
| `subscribe` | `(listener: (snapshot: AnalyticsManagerStateSnapshot) => void) => () => void` | Calls `listener` after each lifecycle pass. Returns an unsubscribe function. |
| `destroy` | `() => void` | Tears down every provider, removes the listeners and handlers and stops the consent engine. |
| `consent` | [`ConsentApi`](#analyticsconsent) | Reads and changes consent. |

Before `boot()` resolves, `track`, `page`, `identify`, `group` and
`captureError` calls are queued, up to 100. Later calls are dropped and
reported once with scope `queue-full`. Calls are delivered only to providers
whose `requiredConsent` is met.

A provider registered with an `id` already in use is ignored and reported with
scope `provider-setup`.

#### `TrackEventOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `eventId` | `string` | `crypto.randomUUID()` | The event ID, shared with the server so providers can deduplicate. |
| `only` | `string[]` | every provider | Sends only to these provider IDs, in the browser and on the server. |
| `providers` | `Record<string, Record<string, unknown>>` | | Extra params merged into what one provider sends, keyed by provider ID. |
| `requireAnalyticsConsent` | `boolean` | `false` | Drops the event, in the browser and on the server, unless analytics is granted. |
| `requireMarketingConsent` | `boolean` | `false` | Drops the event unless marketing is granted. |

#### Identity

`identify(userId, traits)` keeps `userId`, `traits.email` and `traits.phone` as
the identity. The email is trimmed, lowercased and dropped unless it is a valid
address; the phone is stripped of spaces, dashes, dots and parentheses and
dropped unless it is in E.164 format. Providers receive the email and phone
only while marketing consent is granted. The identity is stored only while
analytics or marketing consent is granted. The other traits are passed to each
provider's `identify` hook.

#### `analytics.consent`

| Member | Signature | Description |
|---|---|---|
| `categories` | `readonly ConsentCategory[]` | Every category: `preferences`, `analytics`, `marketing`, then the custom ones. |
| `bootstrap` | `() => Promise<ConsentState \| null>` | Reads the stored choice, else asks each adapter's `bootstrap` in order and stores the first answer. Runs once; later calls return the same promise. `<AnalyticsProvider>` calls it for you. |
| `getConsent` | `() => ConsentState \| null` | The current choice, or `null` before the visitor has made one. |
| `isStale` | `() => boolean` | Whether `bootstrap()` found a stored choice that is too old or was made under another major `policyVersion`. `false` again once the visitor chooses. |
| `setConsent` | `(consent: ConsentState, source?: ConsentChangeSource) => Promise<void>` | Replaces the whole choice, stores it, broadcasts it and applies it to every adapter. `source` defaults to `'imperative'`. An identical choice is ignored, unless the stored one is stale: then it is stored again with the current date and `policyVersion`, and applied to every adapter, so `server.consentEndpoint` records it. |
| `update` | `(partial: Partial<ConsentState>) => Promise<void>` | Awaits `bootstrap()`, then merges `partial` over the current choice. Categories that have never been set are denied. |
| `subscribe` | `(listener: (snapshot: { consent: ConsentState \| null }) => void) => () => void` | Calls `listener` on every change. Returns an unsubscribe function. |

**Errors.** `setConsent` and `update` reject with a `TypeError` when a category
is not a boolean, or when `sale_of_data` is present and not a boolean.

### `createConsentController(analytics, options?)`

Holds what `<AnalyticsProvider>` and the Vue plugin hold, for code without a
framework binding: it bootstraps consent, schedules boot, sends page views and
keeps the state of a consent banner and settings dialog. See
[JavaScript and Astro](/start/javascript/).

| Option | Type | Default | Description |
|---|---|---|---|
| `boot` | `LazyBootConfig` | `{ mode: 'immediate' }` | As on [`<AnalyticsProvider>`](#analyticsprovider). |
| `autoShowBanner` | `boolean` | `true` | As on `<AnalyticsProvider>`. |
| `openConsentGlobalKey` | `string` | `names.openConsentGlobalKey`, plus `ACM_openConsent` with `names.legacy` | As on `<AnalyticsProvider>`. Set by `start()`. |

It returns a `ConsentController`:

| Field | Type | Description |
|---|---|---|
| `start` | `() => () => void` | Bootstraps consent, schedules boot and starts sending page views. Returns a function that stops it. |
| `setRoute` | `(routeKey: string \| null, page?: PageViewPayload) => void` | Sends a page view to each active provider when `routeKey` changes, and to providers that become active later. A change after the first key starts a new page session. `null` holds page views; `page` overrides their `url`, `path` or `title`. |
| `getSnapshot` | `() => ConsentControllerState` | `ready`, `error`, `bannerVisible`, `dialogVisible`, `categories` and `prefs`, as in [`useConsentController()`](#useconsentcontroller). |
| `subscribe` | `(listener: () => void) => () => void` | Calls `listener` after each state change. Returns an unsubscribe function. |
| `actions` | `ConsentControllerActions` | `setPrefs`, `showBanner`, `hideBanner`, `openDialog`, `closeDialog`, `acceptAll`, `rejectNonEssential` and `savePreferences`, as in `useConsentController()`. |

The types `ConsentControllerOptions`, `ConsentControllerState` and
`ConsentControllerActions` are exported too.

### `definePlugin(plugin)`

Returns `plugin` unchanged, typed as an [`AnalyticsPlugin`](#analyticsplugin).
See [Writing a plugin](/internals/plugins/).

```ts
function definePlugin<T extends AnalyticsPlugin>(plugin: T): T
```

### `loadScript(src, attributes?)`

Appends `<script async src>` to `<head>` once per URL.

```ts
function loadScript(src: string, attributes?: Record<string, string>): Promise<void>
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | | **Required.** Resolved against `document.baseURI`. |
| `attributes` | `Record<string, string>` | `{}` | Attributes set on the script element. |

**Returns** a promise that resolves when the script has loaded. It resolves
immediately outside the browser, or when a script with the same URL is already
in the document. Concurrent calls for the same URL share one promise.

**Rejects** with `Error('Failed to load <src>')` when the script fails to load.
The element is removed, so a later call tries again.

### `getFlag(name)` and `setFlag(name, value)`

Read and write `window.__<prefix><name>`, which plugins use to mark one-time
setup. With `names.legacy`, `getFlag` also reads, and `setFlag` also writes,
`window.__acm<name>`. Outside the browser, `getFlag` returns `undefined` and
`setFlag` does nothing.

```ts
function getFlag<T>(name: string): T | undefined
function setFlag<T>(name: string, value: T): T
```

`setFlag` returns `value`.

### `getNames()`

Returns the [`Names`](#names) in use, after `createAnalytics({ names })`.

```ts
function getNames(): Names
```

### `createEnvConfig(env)`

**Deprecated.** Pass `process.env` values to the providers directly; an unset
one turns its provider off. For the instance options, use
`enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'`
and `debug: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'`.

<details>
<summary>Signature and variables</summary>

```ts
function createEnvConfig(env: Record<string, string | undefined>): {
  runtimeEnabled: boolean
  debug: boolean
  ga4: { measurementId: string | undefined }
  hotjar: { siteId: number | undefined; version: number | undefined }
  meta: { pixelId: string | undefined; noscriptEnabled: boolean }
  shopify: {
    storeId: string | undefined
    storefrontDomain: string | undefined
    storefrontAccessToken: string | undefined
  }
  server: {
    metaToken: string | undefined
    facebookTestEventCode: string | undefined
    ga4ApiSecret: string | undefined
  }
}
```

| Variable | Read into |
|---|---|
| `NODE_ENV`, `NEXT_PUBLIC_ENABLE_ANALYTICS` | `runtimeEnabled`: `true` when `NODE_ENV` is `production` or `NEXT_PUBLIC_ENABLE_ANALYTICS` is `'true'` |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | `debug`: `true` when `'true'` |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | `ga4.measurementId` |
| `NEXT_PUBLIC_HOTJAR_SITE_ID`, `NEXT_PUBLIC_HOTJAR_VERSION` | `hotjar.siteId`, `hotjar.version`, parsed as numbers; `undefined` when missing or not finite |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | `meta.pixelId` |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT` | `meta.noscriptEnabled`: `true` when `'true'` |
| `NEXT_PUBLIC_SHOPIFY_STORE_ID`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN` | `shopify.storeId`, `shopify.storefrontDomain`, `shopify.storefrontAccessToken` |
| `META_TOKEN`, `FACEBOOK_TEST_EVENT_CODE`, `GA4_API_SECRET` | `server.metaToken`, `server.facebookTestEventCode`, `server.ga4ApiSecret` |

</details>

### Storage adapters

| Function | Returns | Description |
|---|---|---|
| `createLocalStorageConsentStorage(options)` | `ConsentStorageAdapter` | The `StoredConsent` record as JSON in `localStorage`. A value stored before 1.0, the bare `ConsentState`, is read as a record without a date. `subscribe` listens for `storage` events, so changes in other tabs apply. |
| `createLocalStorageIdentityStorage(options)` | `IdentityStorageAdapter` | The identity as JSON in `localStorage`. |
| `createMemoryConsentStorage(initial?)` | `ConsentStorageAdapter` | Consent in memory. `initial` defaults to `null`. |
| `createMemoryIdentityStorage(initial?)` | `IdentityStorageAdapter` | The identity in memory. `initial` defaults to `{}`. |

The `localStorage` adapters never throw: when storage is blocked or full, reads
return `null` (consent) or `{}` (identity) and writes are skipped.

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | | **Required.** The storage key. |
| `legacyKeys` | `string[]` | the `acm_*` key, when `names.legacy` is on and `key` is the configured one | Keys whose value is moved to `key` on the first read. |
| `storage` | `Storage` | `window.localStorage` | The `Storage` object to use. |
| `window` | `Window` | `window` | The window whose `storage` events are observed. |

<details>
<summary>Adapter interfaces</summary>

```ts
type StoredConsent = {
  consent: ConsentState
  /** When the choice was made, in milliseconds since the epoch. */
  updatedAt?: number
  /** The `consent.policyVersion` it was made under. */
  policyVersion?: string
}

interface ConsentStorageAdapter {
  read(): StoredConsent | null
  write(record: StoredConsent | null): void
  subscribe?(listener: () => void): () => void
  clear?(): void
}

interface IdentityStorageAdapter {
  read(): UserIdentity
  write(identity: Partial<UserIdentity>): void
  clear?(): void
}

interface ConsentIntegrationAdapter {
  id: string
  /** Called by bootstrap() when nothing is stored. Errors go to onError with scope 'consent-adapter'. */
  bootstrap?(): Promise<ConsentState | null> | ConsentState | null
  /** Called on every change not made by this adapter. Errors go to onError with scope 'consent-adapter'. */
  apply?(consent: ConsentState): Promise<void> | void
  /** Reports changes made in the external platform. */
  subscribe?(onConsent: (consent: ConsentState) => void): (() => void) | void
}
```

</details>

### Names

`NamesInput` is the type of `createAnalytics({ names })`; `Names` is what
`getNames()` returns. Every name not given derives from `prefix`. See
[Names](/guides/names/).

| Field | Type | Default |
|---|---|---|
| `prefix` | `string` | `'consentlayer'` |
| `legacy` | `boolean` | `false`. When `true`, the `acm` names are also read and written. |
| `consentStorageKey` | `string` | `` `${prefix}_consent` `` |
| `identityStorageKey` | `string` | `` `${prefix}_user_identity` `` |
| `consentEventName` | `string` | `` `${prefix}:consent` `` |
| `consentGlobalKey` | `string` | `` `${PREFIX}_CONSENT` `` (upper case) |
| `openConsentGlobalKey` | `string` | `` `${PREFIX}_openConsent` `` (upper-case prefix) |
| `autoTrackingEvents.pageSessionStart` | `string` | `` `${prefix}.page_session_start` `` |
| `autoTrackingEvents.scrollDepth` | `string` | `` `${prefix}.scroll_depth` `` |
| `autoTrackingEvents.timeOnPage` | `string` | `` `${prefix}.time_on_page` `` |
| `autoTrackingEvents.uiClick` | `string` | `` `${prefix}.ui_click` `` |

<details>
<summary>Type signatures</summary>

```ts
type AutoTrackingEventNames = {
  pageSessionStart: string
  scrollDepth: string
  timeOnPage: string
  uiClick: string
}

type Names = {
  prefix: string
  legacy: boolean
  consentStorageKey: string
  identityStorageKey: string
  consentEventName: string
  consentGlobalKey: string
  openConsentGlobalKey: string
  autoTrackingEvents: AutoTrackingEventNames
}

type NamesInput = Partial<Omit<Names, 'autoTrackingEvents'>> & {
  autoTrackingEvents?: Partial<AutoTrackingEventNames>
}
```

</details>

### Consent types

#### Custom categories

Declare custom categories by augmenting `ConsentCategories`, then pass them to
`createAnalytics({ categories })`. They become part of `ConsentCategory` and
`ConsentState`, and are stored, broadcast and sent to the server like the
built-in ones.

```ts
declare module 'consentlayer' {
  interface ConsentCategories {
    functional: true
  }
}

createAnalytics({ categories: ['functional'] })
```

<details>
<summary>Type signatures</summary>

```ts
interface ConsentCategories {}

type ConsentCategory = keyof ({ preferences: true; analytics: true; marketing: true } & ConsentCategories)

/** Necessary cookies are always allowed, so they have no flag. */
type ConsentState = Record<ConsentCategory, boolean> & {
  sale_of_data?: boolean
}

type ConsentChangeSource = 'bootstrap' | 'storage' | 'adapter' | 'imperative' | 'unknown'

type ConsentEngineSnapshot = { consent: ConsentState | null }

type ConsentApi = {
  categories: readonly ConsentCategory[]
  bootstrap: () => Promise<ConsentState | null>
  getConsent: () => ConsentState | null
  setConsent: (consent: ConsentState, source?: ConsentChangeSource) => Promise<void>
  subscribe: (listener: (snapshot: ConsentEngineSnapshot) => void) => () => void
  update(partial: Partial<ConsentState>): Promise<void>
}
```

</details>

### Event types

#### `StandardEvents`

Standard events are named after GA4's, and every provider translates them.
Any other name is sent as a custom event. `EventParams<Name>` is
`StandardEvents[Name] & Record<string, unknown>` for a standard event and
`Record<string, unknown>` otherwise.

<details>
<summary>Type signatures</summary>

```ts
type Money = { value?: number; currency?: string }
type EcommerceParams = Money & { items?: EcommerceItem[] }

interface StandardEvents {
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
  purchase: EcommerceParams & { transaction_id: string; tax?: number; shipping?: number; coupon?: string }
  refund: EcommerceParams & { transaction_id: string }
  trial_started: Money & { plan?: string }
  subscription_started: Money & { plan?: string }
  subscription_cancelled: { plan?: string; reason?: string }
}

type EcommerceItem = {
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

type PageViewPayload = { url?: string; path?: string; title?: string }

type UserIdentity = { userId?: string; email?: string; phone?: string }

type UserTraits = Record<string, unknown> & { email?: string; phone?: string }

type ErrorContext = {
  level?: 'fatal' | 'error' | 'warning'
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  source?: 'manual' | 'global' | 'boundary'
}

type AnalyticsManagerStateSnapshot = {
  booted: boolean
  consent: ConsentState | null
  /** IDs of the providers whose consent requirement is met and that are running. */
  activeProviders: string[]
}
```

</details>

#### `ServerEvent`

What `createAnalytics({ server: { endpoint } })` posts, and what
[`sendServerEvent`](#sendservereventevent-options) takes. Also exported from
`consentlayer/server`.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | **Required.** The event name; `page_view` for page views. |
| `consent` | `ConsentState` | **Required.** The consent the event was collected under. |
| `id` | `string` | The browser event's ID, for deduplication. |
| `params` | `Record<string, unknown>` | The event params. |
| `identity` | `UserIdentity` | The user. The browser includes `email` and `phone` only with marketing consent. |
| `url` | `string` | The page URL. |
| `clientId` | `string` | The GA4 client ID. `ga4Server` reads it from the `_ga` cookie when omitted. |
| `only` | `string[]` | Sends only to these destination IDs. |
| `providers` | `Record<string, Record<string, unknown>>` | Extra params per destination ID. |

### `AnalyticsPlugin`

The interface every provider implements. ConsentLayer runs `setup` at boot;
`load` once, when `requiredConsent` is met (at boot with `loadBeforeConsent`);
`consent` on every consent change. `page`, `track`, `identify` and `group` run
only while consent is met, and a withdrawal runs `teardown`. Each hook receives
a [`PluginContext`](#plugincontext) as its last argument. An exception in a
hook is reported to `onError` and does not affect other providers. See
[Writing a plugin](/internals/plugins/) and the
[lifecycle](/internals/lifecycle/).

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | | **Required.** Unique per instance. Used by `only` and `providers`. |
| `requiredConsent` | `ProviderConsentRequirement` | `'none'` | A category, `'none'`, or `(consent: ConsentState \| null) => boolean`. |
| `loadBeforeConsent` | `boolean` | `false` | Runs `load` at boot, before consent; the provider relies on its own consent mode. |
| `defer` | `LoadTiming` | `false` | When `load` runs once allowed: `false` immediately, `'idle'` on `requestIdleCallback` (5000 ms timeout), `'interaction'` on the first `pointerdown`, `keydown`, `scroll` or `touchstart`, or a number of milliseconds. Up to 100 calls are held meanwhile and delivered after `load`. |
| `setup` | `(ctx) => void \| Promise<void>` | | Runs at boot. Must not use the network or set cookies. |
| `load` | `(ctx) => void \| Promise<void>` | | Injects scripts. Runs once. |
| `consent` | `(ctx) => void \| Promise<void>` | | Applies `ctx.consent`. |
| `page` | `(page: PageEvent, ctx) => void \| Promise<void>` | | A page view. `PageEvent` is `PageViewPayload & { id: string }`. |
| `track` | `(event: AnalyticsEventPayload, ctx) => void \| Promise<void>` | | An event: `{ id, name, params, options }`. |
| `identify` | `(identity: UserIdentity, traits: UserTraits, ctx) => void \| Promise<void>` | | The user's identity, filtered by consent. |
| `reset` | `(ctx) => void \| Promise<void>` | | Forget the user. |
| `group` | `(groupId: string, traits: Record<string, unknown>, ctx) => void \| Promise<void>` | | A group association. |
| `error` | `(error: unknown, context: ErrorContext, ctx) => void \| Promise<void>` | | Errors from `captureError` and the global handlers. |
| `teardown` | `(ctx) => void \| Promise<void>` | | Stop sending and remove cookies where possible. |

#### `PluginContext`

| Field | Type | Description |
|---|---|---|
| `consent` | `ConsentState \| null` | The current consent. |
| `identity` | `UserIdentity` | The identity, with `email` and `phone` only under marketing consent. |
| `debug` | `boolean` | Whether the instance's `debug` option is on. |
| `log` | `(message: string, ...data: unknown[]) => void` | Logs under the `providers` [`debug`](#debug) topic, attributed to the plugin. |
| `emitError` | `(error: AnalyticsError) => void` | Reports an error; `providerId` defaults to the plugin's `id`. |

### `AnalyticsError`

Errors inside providers, server forwarding and consent adapters are never
thrown to your code. They are passed to `onError`:

```ts
type AnalyticsError = {
  scope: AnalyticsErrorScope
  providerId?: string
  message: string
  cause?: unknown
}

type AnalyticsErrorHandler = (error: AnalyticsError) => void
```

| `scope` | Raised when |
|---|---|
| `provider-setup`, `provider-load`, `provider-consent`, `provider-page`, `provider-track`, `provider-error`, `provider-teardown` | The plugin hook of that name throws. `provider-setup` is also raised for a duplicate provider ID. |
| `provider-identify` | The `identify`, `reset` or `group` hook throws. |
| `provider-script-load` | A provider's vendor script fails to load. |
| `server-forward` | Posting to `server.endpoint` fails or returns a non-2xx status. |
| `consent-adapter` | An adapter's `bootstrap` or `apply` throws, including the `server.consentEndpoint` recorder. After a failed `bootstrap`, the next adapter is asked. |
| `queue-full` | 100 calls are already waiting for boot or for a deferred `load`. |

<details>
<summary>All exported types</summary>

`Analytics`, `AnalyticsError`, `AnalyticsErrorHandler`, `AnalyticsErrorScope`,
`AnalyticsEventPayload`, `AnalyticsManagerStateSnapshot`, `AnalyticsOptions`,
`AnalyticsPlugin`, `AutoTrackingClickConfig`, `AutoTrackingClickMode`,
`AutoTrackingConfig`, `AutoTrackingEventNames`, `AutoTrackingScrollConfig`,
`AutoTrackingTimeConfig`, `ConsentApi`, `ConsentBroadcastConfig`,
`ConsentCategories`, `ConsentCategory`, `ConsentChangeSource`,
`ConsentEngineSnapshot`, `ConsentIntegrationAdapter`, `ConsentState`,
`ConsentStorageAdapter`, `EcommerceItem`, `ErrorContext`, `EventParams`,
`IdentityStorageAdapter`, `LazyBootConfig`, `LazyBootMode`, `LoadTiming`,
`Names`, `NamesInput`, `PageEvent`, `PageViewPayload`, `PluginContext`,
`ProviderConsentRequirement`, `ServerEvent`, `StandardEvents`,
`TrackEventOptions`, `UserIdentity`, `UserTraits`.

</details>

## `consentlayer/react`

Requires `react` and `react-dom` 18.3 or 19. The entry point starts with a
`'use client'` directive.

### `<AnalyticsProvider>`

Bootstraps consent, boots the instance, sends a page view on each navigation
and provides the state for [`useConsentController()`](#useconsentcontroller).

| Prop | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | | **Required.** The instance. |
| `children` | `ReactNode` | | **Required.** |
| `routeKey` | `string \| null` | `'default'` | Identifies the current route. Each active provider receives one page view per key, including providers that become active later on the same route. A new key also starts a new page session, except the first key after `null`. `null` holds page views until the route is known. In Next.js, use [`consentlayer/next`](#consentlayernext), which sets it for you. |
| `page` | `PageViewPayload` | | Overrides the page view's `url`, `path` or `title`. |
| `boot` | `LazyBootConfig` | `{ mode: 'immediate' }` | When to call `analytics.boot()`. Read once, on mount. |
| `boot.mode` | `'immediate' \| 'idle' \| 'manual'` | `'immediate'` | `'idle'` waits for `requestIdleCallback`; `'manual'` leaves the call to you. |
| `boot.timeoutMs` | `number` | `3000`, or `1500` without `requestIdleCallback` | In `'idle'` mode, the `requestIdleCallback` timeout, or the `setTimeout` delay where it is unavailable. |
| `autoShowBanner` | `boolean` | `true` | Sets `bannerVisible` when no choice is stored, the stored choice is stale, or bootstrap fails. |
| `openConsentGlobalKey` | `string` | `names.openConsentGlobalKey`, plus `ACM_openConsent` with `names.legacy` | A window function with this name opens the settings dialog. |

The props type is exported as `AnalyticsProviderProps`.

### `useAnalytics()`

```ts
function useAnalytics(): Analytics
```

**Returns** the instance from the closest `<AnalyticsProvider>`, else the
instance most recently created by `createAnalytics()`.

**Throws** an `Error` when neither exists.

### `useConsent()`

Returns the current consent and re-renders when it changes. Works outside
`<AnalyticsProvider>` under the same rule as `useAnalytics()`.

```ts
function useConsent(): {
  consent: ConsentState | null
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
}
```

`engine` is `analytics.consent`; `setConsent` and `update` call it.

**Throws** like `useAnalytics()`.

### `useConsentController()`

State and actions for building a consent banner and settings dialog. See
[Consent UI](/guides/consent-ui/).

| Field | Type | Description |
|---|---|---|
| `ready` | `boolean` | `true` once `bootstrap()` has settled. |
| `error` | `string \| null` | The bootstrap error, converted with `String()`, or `null`. |
| `bannerVisible` | `boolean` | Whether the banner should render. |
| `showBanner`, `hideBanner` | `() => void` | Set `bannerVisible`. |
| `dialogVisible` | `boolean` | Whether the settings dialog should render. |
| `openDialog`, `closeDialog` | `() => void` | Set `dialogVisible`. |
| `categories` | `readonly ConsentCategory[]` | The categories the dialog shows, from `analytics.consent.categories`. |
| `prefs` | `Record<ConsentCategory, boolean>` | The dialog's toggles, one per category; kept in sync with the current consent. |
| `setPrefs` | `(next: Record<ConsentCategory, boolean>) => void` | Changes the toggles without saving them. |
| `acceptAll` | `() => Promise<void>` | Grants every category. |
| `rejectNonEssential` | `() => Promise<void>` | Denies every category. |
| `savePreferences` | `() => Promise<void>` | Saves `prefs`. |

`acceptAll`, `rejectNonEssential` and `savePreferences` call `setConsent` and
then hide the banner and the dialog.

**Throws** an `Error` outside `<AnalyticsProvider>`.

### `<ErrorBoundary>`

Renders `fallback` when a descendant throws during rendering, and sends the
error through `captureError` with `source: 'boundary'`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `fallback` | `ReactNode \| ((props: { error: unknown; reset: () => void }) => ReactNode)` | | **Required.** `reset()` clears the error and renders `children` again. |
| `children` | `ReactNode` | | **Required.** |
| `analytics` | `Analytics` | the `<AnalyticsProvider>` instance, else the latest `createAnalytics()` instance | The instance that receives the error. |
| `tags` | `Record<string, string>` | | Passed as `context.tags`. |

The props type is exported as `ErrorBoundaryProps`.

### `createGlobalError(analytics, render?)`

Builds the default export of a Next.js `app/global-error.tsx`. That file
replaces the root layout, so `<AnalyticsProvider>` is not mounted and the
instance is passed explicitly.

```ts
function createGlobalError(
  analytics: Analytics,
  render?: (props: { error: unknown; reset: () => void }) => ReactNode,
): (props: { error: Error & { digest?: string }; reset: () => void }) => JSX.Element
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | | **Required.** |
| `render` | `(props: { error: unknown; reset: () => void }) => ReactNode` | A heading, "Something went wrong.", and a "Try again" button that calls `reset` | The page body. |

**Returns** a component that renders `<html lang="en"><body>` around
`render`. On mount it calls `analytics.consent.bootstrap()`, then
`analytics.boot()`, then `captureError` with `level: 'fatal'`,
`source: 'boundary'` and, when Next.js provides one, a `digest` tag.

```tsx title="app/global-error.tsx"
'use client'
import { createGlobalError } from 'consentlayer/react'
import { analytics } from '@/lib/analytics'

export default createGlobalError(analytics)
```

### `<MetaPixelNoscript>`

Renders Meta's `<noscript>` PageView pixel. It fires only for visitors without
JavaScript, who never see the consent banner, so it tracks them without
consent. Render it only where that is lawful.

| Prop | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | | **Required.** Renders nothing while `undefined` or empty. |
| `enabled` | `boolean` | `undefined` | Renders nothing unless `true`. |
| other `<img>` props | `ComponentPropsWithoutRef<'img'>` | `width` and `height` `1`, `style.display` `'none'` | Passed to the image. `alt` is always `''`. |

## `consentlayer/next`

Requires `next` 15 or 16, an optional peer dependency, and works in the App
Router and the Pages Router: it reads the route from `next/navigation` and,
in the Pages Router, waits for `router.isReady` from `next/compat/router`. The
entry point starts with a `'use client'` directive.

### `<AnalyticsProvider>` for Next.js

The [`<AnalyticsProvider>`](#analyticsprovider) from `consentlayer/react`, with
`routeKey` taken from the Next.js router: the pathname and the query string from
`usePathname()` and `useSearchParams()`. A change to either sends a page view
and starts a new page session. In the Pages Router, `routeKey` stays `null`
until `router.isReady`, so the first page view carries the real query string.

It accepts every prop of the React provider except `routeKey`; the props type
is exported as `NextAnalyticsProviderProps`.

```ts
type NextAnalyticsProviderProps = Omit<AnalyticsProviderProps, 'routeKey'>
```

Only the internal component that reads the route sits in a
`<Suspense fallback={null}>` boundary, so your pages are still rendered on the
server. Until that component reports the first route, `routeKey` is `null` and
page views are held.

## `consentlayer/vue`

Requires `vue` 3.5 or later, an optional peer dependency. Vue Router is not a
dependency; the plugin uses only `currentRoute`, `isReady()` and `afterEach()`
of the router you pass.

### `consentLayer`

A Vue plugin. `app.use(consentLayer, options)` provides the instance and the
consent UI state to every component. In the browser, it also bootstraps
consent, schedules boot, sends page views and wraps `app.config.errorHandler`.
On the server, it only provides them. `app.unmount()` stops it.

| Option | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | | **Required.** The instance. |
| `router` | `RouterLike` | | Sends a page view after every successful navigation, once per path and query string; the hash is ignored. A new path or query string also starts a new page session. Without it, one page view is sent for the page load. |
| `page` | `PageViewPayload` | | Overrides the page view's `url`, `path` or `title`. |
| `boot` | `LazyBootConfig` | `{ mode: 'immediate' }` | As on [`<AnalyticsProvider>`](#analyticsprovider). |
| `autoShowBanner` | `boolean` | `true` | As on `<AnalyticsProvider>`. |
| `openConsentGlobalKey` | `string` | `names.openConsentGlobalKey`, plus `ACM_openConsent` with `names.legacy` | As on `<AnalyticsProvider>`. |
| `captureErrors` | `boolean` | `true` | Sends errors reaching `app.config.errorHandler` through `captureError` with `source: 'boundary'` and a `vue_info` tag, then calls the handler set before the plugin, else `console.error`. |

The options type is exported as `ConsentLayerOptions`, and the router type as
`RouterLike`.

### `useAnalytics()` for Vue

```ts
function useAnalytics(): Analytics
```

**Returns** the instance passed to `consentLayer`, else the instance most
recently created by `createAnalytics()`.

**Throws** an `Error` when neither exists.

### `useConsent()` for Vue

```ts
function useConsent(): {
  consent: Readonly<Ref<ConsentState | null>>
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
}
```

As the React [`useConsent()`](#useconsent), with `consent` as a ref. Called
inside an effect scope, such as a component's `setup`, it stops listening when
the scope is disposed.

### `useConsentController()` for Vue

The fields of the React [`useConsentController()`](#useconsentcontroller),
with `ready`, `error`, `bannerVisible`, `dialogVisible`, `categories` and
`prefs` as read-only refs. The return type is exported as `ConsentController`.

**Throws** an `Error` when `consentLayer` is not installed.

### `<MetaPixelNoscript>` for Vue

The React [`<MetaPixelNoscript>`](#metapixelnoscript) as a Vue component, with
the props `pixel-id` and `enabled`. Other attributes are passed to the image.
It renders the image as the `<noscript>` element's HTML, so hydration doesn't
compare it with the text browsers parse there when JavaScript is on.

## `consentlayer/nuxt`

A Nuxt module for Nuxt 4, an optional peer dependency. Add it to `modules` in
`nuxt.config.ts`. At build time it:

- reads `app/consentlayer.config.ts`, and throws when the file is missing;
- adds a plugin that calls the config file's function, passes the result to
  `createAnalytics()`, and installs [`consentLayer`](#consentlayer-1) with that
  instance, Nuxt's router and the module options, with `captureErrors: false`;
- in the browser, unless the `captureErrors` option is `false`, sends errors
  from Nuxt's `vue:error` hook through `captureError` with `source: 'boundary'`
  and a `vue_info` tag;
- auto-imports `defineConsentLayerConfig`, `useAnalytics`, `useConsent` and
  `useConsentController`, and registers the `<MetaPixelNoscript>` component.

The module options, under the `consentlayer` key of `nuxt.config.ts`, are the
[`consentLayer`](#consentlayer-1) options except `analytics` and `router`. They
are serialized into the build, so they can't hold functions. The type is
exported as `ModuleOptions`.

### `defineConsentLayerConfig(factory)`

```ts
function defineConsentLayerConfig(factory: () => AnalyticsOptions): () => AnalyticsOptions
```

Returns `factory`, typed. Export its result as the default export of
`app/consentlayer.config.ts`. The plugin calls `factory` on the server for each
request and once in the browser, inside the Nuxt app context, so composables
such as `useRuntimeConfig()` work in it. `AnalyticsOptions` are the options of
[`createAnalytics()`](#createanalyticsoptions).

## `consentlayer/svelte`

Requires `svelte` 5.7 or later, an optional peer dependency. SvelteKit is not
a dependency; with SvelteKit, use [`consentlayer/sveltekit`](#consentlayersveltekit).
Every function here reads or sets a Svelte context, so call it while a
component initializes.

### `consentLayer(options)`

```ts
function consentLayer(options: ConsentLayerOptions): ConsentController
```

Provides the instance and the consent UI state to every component below the
one that calls it, and returns the state. Once that component is mounted, it
bootstraps consent, schedules boot and sends page views; when it is destroyed,
it stops. On the server it only provides them.

| Option | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | | **Required.** The instance. |
| `afterNavigate` | `AfterNavigateLike` | | A function shaped like SvelteKit's `afterNavigate`. Sends a page view after the first render and every navigation, once per path and query string; the hash is ignored. A new path or query string also starts a new page session. Without it, one page view is sent for the page load. |
| `page` | `PageViewPayload` | | Overrides the page view's `url`, `path` or `title`. |
| `boot` | `LazyBootConfig` | `{ mode: 'immediate' }` | As on [`<AnalyticsProvider>`](#analyticsprovider). |
| `autoShowBanner` | `boolean` | `true` | As on `<AnalyticsProvider>`. |
| `openConsentGlobalKey` | `string` | `names.openConsentGlobalKey`, plus `ACM_openConsent` with `names.legacy` | As on `<AnalyticsProvider>`. |

The options type is exported as `ConsentLayerOptions`, and the navigation type
as `AfterNavigateLike`:

```ts
type AfterNavigateLike = (callback: (navigation: { to: { url: URL } | null }) => void) => void
```

### `useAnalytics()` for Svelte

```ts
function useAnalytics(): Analytics
```

**Returns** the instance passed to `consentLayer()`, else the instance most
recently created by `createAnalytics()`.

**Throws** an `Error` when neither exists.

### `useConsent()` for Svelte

```ts
function useConsent(): {
  readonly consent: ConsentState | null
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
}
```

As the React [`useConsent()`](#useconsent), with `consent` as a reactive
property. It listens for changes only while a template, `$derived` or
`$effect` reads it.

### `useConsentController()` for Svelte

The fields of the React [`useConsentController()`](#useconsentcontroller),
with `ready`, `error`, `bannerVisible`, `dialogVisible`, `categories` and
`prefs` as reactive read-only properties. The return type is exported as
`ConsentController`.

**Throws** an `Error` when no parent component called `consentLayer()`.

### `<MetaPixelNoscript>` for Svelte

The React [`<MetaPixelNoscript>`](#metapixelnoscript) as a Svelte component,
with the props `pixelId` and `enabled`. Other attributes are passed to the
image. It ships as Svelte source, which your Svelte compiler builds; the
package's `svelte` export condition points Vite at it.

## `consentlayer/sveltekit`

`MetaPixelNoscript`, `useAnalytics`, `useConsent`, `useConsentController` and
the `ConsentController` type from `consentlayer/svelte`, plus the two functions
below. It imports `afterNavigate` from
SvelteKit's `$app/navigation`, so it only works inside a SvelteKit
application.

### `consentLayer(options)` for SvelteKit

```ts
function consentLayer(options: SvelteKitConsentLayerOptions): ConsentController
type SvelteKitConsentLayerOptions = Omit<ConsentLayerOptions, 'afterNavigate'>
```

The Svelte [`consentLayer()`](#consentlayeroptions) with SvelteKit's
`afterNavigate`. Call it in the root layout.

### `handleErrorWith(analytics)`

```ts
function handleErrorWith(analytics: Analytics): (input: { kind: string; error: unknown }) => void
```

Returns a client [`handleError`](https://svelte.dev/docs/kit/hooks)
hook. It calls `analytics.captureError(error, { source: 'boundary' })` when
`kind` is `'unknown'`, the errors your code threw, and skips `'app'` and
`'framework'` errors. It returns nothing, so SvelteKit shows its default
message.

## `consentlayer/solid`

Requires `solid-js` 1.9 or later, an optional peer dependency. The components
are plain functions, so they work with any Solid JSX setup.

### `<AnalyticsProvider>` for Solid

The React [`<AnalyticsProvider>`](#analyticsprovider) as a Solid component,
with the same props. `routeKey` and `page` are read reactively; `boot`,
`autoShowBanner` and `openConsentGlobalKey` are read once, when it is created.
It starts once mounted and stops when disposed; on the server it only provides
the instance and the state. The props type is exported as
`AnalyticsProviderProps`.

### `useAnalytics()` for Solid

```ts
function useAnalytics(): Analytics
```

**Returns** the instance from the closest `<AnalyticsProvider>`, else the
instance most recently created by `createAnalytics()`.

**Throws** an `Error` when neither exists.

### `useConsent()` for Solid

```ts
function useConsent(): {
  consent: Accessor<ConsentState | null>
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
}
```

As the React [`useConsent()`](#useconsent), with `consent` as an accessor. It
listens for changes until the calling component is disposed.

### `useConsentController()` for Solid

The fields of the React [`useConsentController()`](#useconsentcontroller),
with `ready`, `error`, `bannerVisible`, `dialogVisible`, `categories` and
`prefs` as reactive read-only properties. The return type is exported as
`ConsentController`.

**Throws** an `Error` when no `<AnalyticsProvider>` is above the component.

### `<ErrorBoundary>` for Solid

Solid's `<ErrorBoundary>`, which also sends the error through `captureError`
with `source: 'boundary'`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `fallback` | `JSX.Element \| ((error: unknown, reset: () => void) => JSX.Element)` | | **Required.** `reset()` clears the error and renders `children` again. |
| `children` | `JSX.Element` | | |
| `analytics` | `Analytics` | the `<AnalyticsProvider>` instance, else the latest `createAnalytics()` instance | The instance that receives the error. |
| `tags` | `Record<string, string>` | | Passed as `context.tags`. |

The props type is exported as `ErrorBoundaryProps`.

### `<MetaPixelNoscript>` for Solid

The React [`<MetaPixelNoscript>`](#metapixelnoscript) as a Solid component,
with the props `pixelId` and `enabled`. Other attributes are passed to the
image.

## `consentlayer/solidstart`

`ErrorBoundary`, `MetaPixelNoscript`, `useAnalytics`, `useConsent`,
`useConsentController` and the `ConsentController` and `ErrorBoundaryProps`
types from `consentlayer/solid`, plus the provider below. It imports
`useLocation` and `useIsRouting` from `@solidjs/router`, so it works in any
application that uses Solid Router, with or without SolidStart.

### `<AnalyticsProvider>` for SolidStart

The Solid [`<AnalyticsProvider>`](#analyticsprovider-for-solid), with
`routeKey` set to the path and query string of `useLocation()`, and `null`
while `useIsRouting()` is `true`, so each page view is sent once the browser's
URL has changed. Render it in the `root` of `<Router>`.

```ts
type SolidStartAnalyticsProviderProps = Omit<AnalyticsProviderProps, 'routeKey'>
```

## `consentlayer/angular`

Requires `@angular/core` 20 or later, an optional peer dependency, and
`@angular/router` for page views on navigation. The functions are plain
TypeScript, so they need no Angular compiler step.

### `provideConsentLayer(options)`

```ts
function provideConsentLayer(options: ConsentLayerOptions): EnvironmentProviders
```

Add it to the application's providers. It provides the instance and the
consent state. In the browser, it starts once `ApplicationRef.whenStable()`
resolves and stops when the application is destroyed; it sends a page view on
every `NavigationEnd` to a new path or query string, or one page view when the
Angular Router is not provided. On the server it only provides the instance and
the state.

| Option | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | | **Required.** |
| `captureErrors` | `boolean` | `true` | Provides an `ErrorHandler` that sends each error through `captureError` with `source: 'boundary'`, in the browser, then logs it as Angular's default `ErrorHandler` does. |
| `page` | `PageViewPayload` | | Merged into every page view. |
| `boot`, `autoShowBanner`, `openConsentGlobalKey` | | | As on the React [`<AnalyticsProvider>`](#analyticsprovider). |

### `injectAnalytics()`

```ts
function injectAnalytics(): Analytics
```

**Returns** the instance from `provideConsentLayer()`, else the instance most
recently created by `createAnalytics()`. Call it in an injection context.

**Throws** an `Error` when neither exists.

### `injectConsent()`

```ts
function injectConsent(): {
  consent: Signal<ConsentState | null>
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
}
```

As the React [`useConsent()`](#useconsent), with `consent` as a read-only
signal. In the browser it listens for changes until the injector that called it
is destroyed.

### `injectConsentController()`

The fields of the React [`useConsentController()`](#useconsentcontroller),
with `ready`, `error`, `bannerVisible`, `dialogVisible`, `categories` and
`prefs` as signals. The return type is exported as `ConsentController`.

**Throws** an `Error` when `provideConsentLayer()` is not provided.

### `provideMetaPixelNoscript(options)`

```ts
function provideMetaPixelNoscript(
  options: { pixelId: string | undefined; enabled?: boolean } & Record<string, unknown>,
): EnvironmentProviders
```

On the server, appends the React [`<MetaPixelNoscript>`](#metapixelnoscript)
markup to the end of `<body>`. It adds nothing in the browser, without
`enabled`, or while `pixelId` is `undefined` or empty. Other options become
attributes of the image.

## `consentlayer/providers/*`

Each provider is its own entry point, and each factory returns an
`AnalyticsPlugin`. See [Providers](/guides/providers/) for setup and
[Provider internals](/internals/providers/) for what each one sends.

| Factory | Entry point | `id` | `requiredConsent` |
|---|---|---|---|
| `ga4` | `consentlayer/providers/ga4` | `ga4` | `analytics` |
| `meta` | `consentlayer/providers/meta` | `meta` | `marketing` |
| `posthog` | `consentlayer/providers/posthog` | `posthog` | `'none'` when `cookieless`, else `analytics` |
| `sentry` | `consentlayer/providers/sentry` | `sentry` | `'none'` |
| `contentsquare` | `consentlayer/providers/contentsquare` | `contentsquare` | `analytics` |
| `hotjar` | `consentlayer/providers/hotjar` | `hotjar` | `analytics` |
| `vercel` | `consentlayer/providers/vercel` | `vercel` | `'none'` |
| `tiktok` | `consentlayer/providers/tiktok` | `tiktok` | `marketing` |

### `ga4(options)`

Google Analytics 4 through gtag.js, with Consent Mode v2. Ad signals follow
marketing consent.

| Option | Type | Default | Description |
|---|---|---|---|
| `measurementId` | `string \| undefined` | | **Required.** Must match `G-` followed by 4 to 16 upper-case letters or digits; `undefined` or `''` turns the provider off. |
| `loadBeforeConsent` | `boolean` | `false` | `true` loads gtag.js at boot with Consent Mode set to denied. |
| `consentMode` | `Ga4ConsentMode` | `{ mode: 'basic' }` | See below and [Google Consent Mode](/guides/providers/#google-consent-mode). |

```ts
type Ga4ConsentMode = {
  /** 'advanced' loads and configures the tag at boot, for cookieless pings. */
  mode?: 'basic' | 'advanced'
  /** Advanced mode only. */
  regions?: Ga4RegionDefault[]
  /** Milliseconds, as `wait_for_update`. */
  waitForUpdate?: number
  urlPassthrough?: boolean
  adsDataRedaction?: boolean
}

/** ISO 3166-2 codes, such as 'US' or 'US-CA', and the categories granted there before a choice. */
type Ga4RegionDefault = {
  region: string[]
  preferences?: boolean
  analytics?: boolean
  marketing?: boolean
}
```

**Throws** an `Error` when `measurementId` is invalid, when `regions` is set
without `mode: 'advanced'` or holds a code that is not ISO 3166-2, or when
`waitForUpdate` is not a whole number of `0` or more.

The entry point also exports the types `Ga4Options`, `Ga4ConsentMode` and
`Ga4RegionDefault`, and two helpers:

| Export | Signature | Description |
|---|---|---|
| `ga4EventName` | `(name: string) => string` | The GA4 name of an event: `lead` becomes `generate_lead`; other characters than letters, digits and `_` become `_`. |
| `ga4UserData` | `(identity: UserIdentity) => Record<string, string>` | GA4 `user_data`: `email`, and `phone_number` with a leading `+`. Empty without an email or phone. |

### `meta(options)`

Meta Pixel. Combine it with [`metaCapi`](#metacapioptions) to also send events
through the Conversions API.

| Option | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | | **Required.** A numeric string of 8 to 20 digits; `undefined` or `''` turns the provider off. |
| `locale` | `string` | `'en_US'` | The locale in the `fbevents.js` URL. |
| `loadBeforeConsent` | `boolean` | `false` | `true` loads the pixel at boot with consent revoked. |

**Throws** an `Error` when `pixelId` is invalid.

The entry point also exports the options type `MetaOptions` and two helpers:

| Export | Signature | Description |
|---|---|---|
| `toMetaEvent` | `(event: AnalyticsEventPayload) => { method: 'track' \| 'trackCustom'; name: string; params: Record<string, unknown> }` | Maps a standard event to a Meta standard event, such as `purchase` to `Purchase`, or to a custom event. Converts `items` to `content_ids`, `contents`, `content_type` and `num_items`, and `search_term` to `search_string`. |
| `metaUserData` | `(identity: UserIdentity) => Record<string, string>` | Advanced matching parameters: `em`, `ph` (digits only) and `external_id`. |

### `posthog(options)`

PostHog product analytics. Requires the optional peer dependency `posthog-js`.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string \| undefined` | | **Required.** The project API key; `undefined` or `''` turns the provider off. |
| `apiHost` | `string` | `'https://us.i.posthog.com'` | The ingestion host or your reverse proxy. |
| `uiHost` | `string` | | PostHog's app URL, such as `https://us.posthog.com`, for toolbar links when `apiHost` is a proxy. |
| `cookieless` | `boolean` | `true` | Counts visitors without cookies or storage until analytics is granted. Requires cookieless mode in the PostHog project settings. `false` loads PostHog only after analytics consent. |
| `autocapture` | `boolean` | `false` | PostHog autocapture. |
| `recording` | `boolean` | `false` | Session recording, after analytics consent. |
| `errors` | `boolean` | `true` | Sends `captureError` errors to PostHog error tracking. |
| `groupType` | `string` | `'company'` | The group type `group()` uses. |
| `defer` | `LoadTiming` | `false` | When to load the SDK. See [`AnalyticsPlugin`](#analyticsplugin). |

The options type is exported as `PostHogOptions`.

### `sentry(options)`

Sentry error monitoring in the browser. Requires the optional peer dependency
`@sentry/browser`. Errors are sent without consent and without personal data:
no IP address, cookies, headers, bodies or query strings. Analytics consent
adds the user ID, Session Replay and tracing; marketing consent adds the
email.

| Option | Type | Default | Description |
|---|---|---|---|
| `dsn` | `string \| undefined` | | **Required.** `undefined` or `''` turns the provider off. |
| `environment` | `string` | | Passed to `Sentry.init`. |
| `release` | `string` | | Passed to `Sentry.init`. |
| `replay` | `boolean \| { sessionSampleRate?: number; onErrorSampleRate?: number }` | `false` | Session Replay, after analytics consent. Sample rates default to `0.1` and `1`. |
| `tracing` | `boolean \| { sampleRate?: number }` | `false` | Performance tracing, after analytics consent. `sampleRate` defaults to `1`. |
| `tunnel` | `string` | | Sends events to this URL instead of the DSN's host. |
| `defer` | `LoadTiming` | `false` | When to load the SDK. See [`AnalyticsPlugin`](#analyticsplugin). |

The options type is exported as `SentryOptions`. For server-side Sentry, see
[`consentlayer/sentry/server`](#consentlayersentryserver).

### `contentsquare(options)`

Contentsquare, Hotjar's successor.

| Option | Type | Default | Description |
|---|---|---|---|
| `tagId` | `string \| undefined` | | **Required.** The ID in your tag's URL, `t.contentsquare.net/uxa/<tagId>.js`; `undefined` or `''` turns the provider off. |

The options type is exported as `ContentsquareOptions`.

### `hotjar(options)`

**Deprecated.** Hotjar accounts are moving to Contentsquare; use
`contentsquare()` once yours has moved.

| Option | Type | Default | Description |
|---|---|---|---|
| `siteId` | `number \| string \| undefined` | | **Required.** A positive integer, as a number or a string of digits. |
| `version` | `number \| string \| undefined` | | **Required.** The Hotjar snippet version, a positive integer as a number or a string of digits. |
| `reloadOnRevoke` | `boolean` | `false` | Hotjar cannot be stopped once loaded. On withdrawal its cookies and storage are always deleted; `true` also reloads the page so recording stops. |

While `siteId` or `version` is `undefined`, `''` or whitespace, the provider is
off and, with `debug`, logs `hotjar is off: siteId is not set.` (or `version`).
Strings are trimmed. Any other value that is not a positive safe integer, or a
string that is not only digits (such as `'1e3'` or `'12.0'`), throws
`[consentlayer] Invalid Hotjar siteId or version: expected positive integers, received … and ….`

The options type is exported as `HotjarOptions`.

### `vercel(options)`

Vercel Analytics. It is cookieless, so it runs without consent. Only `track`
is forwarded; `Date` params become ISO strings, `undefined` becomes
`null`, and objects and arrays are dropped.

| Option | Type | Default | Description |
|---|---|---|---|
| `trackEvent` | `(name: string, payload: Record<string, string \| number \| boolean \| null>) => void` | | **Required.** `track` from `@vercel/analytics`. |

The options type is exported as `VercelOptions`.

### `tiktok(options)`

TikTok Pixel. Combine it with [`tiktokEvents`](#tiktokeventsoptions) to also
send events through the Events API.

| Option | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | | **Required.** `undefined` or `''` turns the provider off. |
| `loadBeforeConsent` | `boolean` | `false` | `true` loads the pixel at boot with `ttq.holdConsent()`. |

The entry point also exports the options type `TikTokOptions` and two helpers:

| Export | Signature | Description |
|---|---|---|
| `toTikTokEvent` | `(event: AnalyticsEventPayload) => { name: string; params: Record<string, unknown> }` | Maps a standard event to a TikTok standard event, such as `purchase` to `Purchase`, or keeps its name. Converts `items` to `content_ids`, `contents`, `content_type` and `num_items`, `search_term` to `search_string` and `transaction_id` to `order_id`. |
| `tiktokUserData` | `(identity: UserIdentity) => Record<string, string>` | Advanced matching parameters for `ttq.identify`: `email` (trimmed, lowercased), `phone_number` (digits prefixed with `+`) and `external_id`. |

### `createShopifyCustomerPrivacyAdapter(options?)`

From `consentlayer/providers/shopify`. A
[`ConsentIntegrationAdapter`](#storage-adapters), with `id`
`'shopify-customer-privacy'`, that syncs consent with Shopify's Customer
Privacy API. Pass it to `createAnalytics({ consent: { adapters } })`.

| Option | Type | Default | Description |
|---|---|---|---|
| `loadFeature` | `boolean` | `true` | Before reading or writing consent, loads Shopify's Customer Privacy script when `headlessStorefront.storefrontAccessToken` is set and `Shopify.customerPrivacy` is missing, then the `consent-tracking-api` feature through `Shopify.loadFeatures` when available. |
| `canBootstrap` | `() => boolean` | | Return `false` to skip reading Shopify's consent during bootstrap. |
| `headlessStorefront` | `{ storefrontAccessToken?: string; checkoutRootDomain?: string; storefrontRootDomain?: string }` | | Required off Shopify-hosted themes. Applies only once `storefrontAccessToken` is set; then passed to `setTrackingConsent` with `headlessStorefront: true`. |
| `document` | `Document` | `document` | The document that receives `visitorConsentCollected` events. |
| `window` | `Window` | `window` | The window that holds `Shopify`. |

The options type is exported as `ShopifyCustomerPrivacyAdapterOptions`.

### `getShopifyCustomerPrivacyScriptUrl()`

From `consentlayer/providers/shopify`. Returns the URL of Shopify's Customer
Privacy script, which the adapter loads on headless storefronts. Use it for a
Content Security Policy or a preload hint.

```ts
function getShopifyCustomerPrivacyScriptUrl(): string
```

## `consentlayer/ecommerce`

Builds the params of the standard ecommerce events from the product, cart and
order shapes most storefront APIs return. See
[Events and identity](/guides/events/).

| Function | Returns | For |
|---|---|---|
| `productParams(product: ProductRef)` | `{ value, currency, items: [item] }`. `value` is price × quantity. | `view_item`, `add_to_cart`, `remove_from_cart`, `add_to_wishlist` |
| `cartParams(cart: CartRef)` | `{ value, currency, items }`. `value` is `subtotal.amount`, else the sum of price × quantity; `currency` is the subtotal's, else the first line's. | `begin_checkout`, `add_payment_info`, `add_shipping_info` |
| `orderParams(order: OrderRef)` | `{ transaction_id, value, currency, tax, shipping, coupon, items }` | `purchase` |
| `toItem(product: ProductRef)` | One `EcommerceItem`. `quantity` defaults to `1`; `price.amount` is converted to a number. | `items[]` entries |

<details>
<summary>Type signatures</summary>

```ts
type MoneyLike = { amount: number | string; currencyCode: string }

type ProductRef = {
  id: string
  variantId?: string
  title?: string
  vendor?: string
  category?: string | null
  price?: MoneyLike
  quantity?: number
}

type CartRef = {
  subtotal?: MoneyLike
  lines: ProductRef[]
}

type OrderRef = {
  orderId: string
  value: number
  currency: string
  tax?: number
  shipping?: number
  coupon?: string | null
  lines: ProductRef[]
}

function toItem(product: ProductRef): EcommerceItem
function productParams(product: ProductRef): StandardEvents['view_item']
function cartParams(cart: CartRef): StandardEvents['begin_checkout']
function orderParams(order: OrderRef): StandardEvents['purchase']
```

`toItem` maps `id` to `item_id`, `title` to `item_name`, `variantId` to
`item_variant`, `vendor` to `item_brand` and `category` to `item_category`.

</details>

## `consentlayer/server`

Runs in Node.js and in edge runtimes. Every handler is a
web-standard `(request: Request) => Promise<Response>`. See
[Server internals](/internals/server/).

### `createAnalyticsHandler(options)`

The route behind `createAnalytics({ server: { endpoint } })`. Validates each
event and sends it to the destinations its consent allows. See
[Server-side tracking](/guides/server-side-tracking/).

```ts
function createAnalyticsHandler(options: {
  destinations: (ServerDestination<true> | undefined)[]
  consentCookie?: ConsentCookieOptions
  onError?: (error: unknown) => void
}): (request: Request) => Promise<Response>
```

| Option | Type | Default | Description |
|---|---|---|---|
| `destinations` | `(ServerDestination<true> \| undefined)[]` | | **Required.** Destinations that accept browser events, such as `metaCapi()`. `ga4Server()` is rejected by the type. `undefined` entries, such as a `metaCapi()` without its token, are skipped. |
| `consentCookie` | `ConsentCookieOptions` | | Takes consent from the cookie signed by `createConsentHandler`, ignoring the body's; without a valid cookie, every category is denied. With `secret` unset, every event is denied and a `console.warn` is logged once when the handler is created; a `secret` shorter than 32 characters makes every request answer `500` before the body is read. |
| `onError` | `(error: unknown) => void` | | Receives each destination failure and any unexpected error. |

| Status | When |
|---|---|
| `204` | The event was processed, including when a destination failed. When `destinations` holds none that accepts browser events, the body is not read and the response carries `consentlayer-forwarding: off`, which stops the browser from forwarding until the page is reloaded. With `consentCookie` and no valid cookie, the response carries `consentlayer-consent: missing`, and the browser [restores the cookie](/guides/consent-records/#the-consent-cookie). |
| `400` | Empty body, invalid JSON, or an invalid event. `name` must match `/^[\w.:-]{1,100}$/` and `consent` must have boolean `preferences`, `analytics` and `marketing`. |
| `403` | Neither `Origin` nor `Referer` is present, the `Referer` is malformed, or the origin differs from the request URL's. |
| `413` | The body exceeds 16 KiB. |
| `415` | The `Content-Type` is not `application/json`. |
| `500` | Any other error; `onError` is called. |

### `sendServerEvent(event, options)`

Sends one event from server code, such as a webhook, to every destination
that `event.consent` and `event.only` allow, in parallel. A destination is
allowed when `event.consent[destination.requiredConsent]` is `true`.

```ts
function sendServerEvent(
  event: ServerEvent,
  options: { destinations: (ServerDestination | undefined)[]; request?: ServerRequestInfo },
): Promise<ServerSendResult[]>
```

| Parameter | Type | Description |
|---|---|---|
| `event` | [`ServerEvent`](#serverevent) | **Required.** |
| `options.destinations` | `(ServerDestination \| undefined)[]` | **Required.** Any destination, including `ga4Server()`. `undefined` entries are skipped. |
| `options.request` | `ServerRequestInfo` | The client's IP, user agent and cookies, when you have them. Build it with [`requestInfo(request)`](#requestinforequest). |

**Returns** one `{ id, ok, error? }` per destination that was called. Skipped
`undefined` entries have no result. A failing destination does not reject the
promise; its error is in `error`.

### `requestInfo(request)`

Reads the client details that destinations use from a `Request`.

```ts
function requestInfo(request: Request): ServerRequestInfo
```

**Returns** `ip`, the first address in `X-Forwarded-For`, else `X-Real-IP`;
`userAgent`, from `User-Agent`; and `cookies`, parsed from `Cookie`.
`createAnalyticsHandler` uses it for every event.

```ts
await sendServerEvent(event, { destinations, request: requestInfo(request) })
```

### `createConsentHandler(options)`

The route behind `createAnalytics({ server: { consentEndpoint } })`. Validates
each choice, appends a [`ConsentRecord`](#consent-records) to the store and
responds with a signed cookie. See [Consent records](/guides/consent-records/).

```ts
function createConsentHandler(options: {
  secret: string | undefined
  cookie?: string
  store: ConsentStore
  policyVersion: string
  categories?: (keyof ConsentCategories)[]
  userId?: (request: Request) => string | undefined | Promise<string | undefined>
  onError?: (error: unknown) => void
}): (request: Request) => Promise<Response>
```

| Option | Type | Default | Description |
|---|---|---|---|
| `secret` | `string \| undefined` | | **Required.** The HMAC-SHA-256 key that signs the cookie. At least 32 characters. An unset or shorter one makes every request answer `500`, with `[consentlayer] the consent secret is not set` or `[consentlayer] the consent secret needs at least 32 characters` passed to `onError`, before the body is read or anything is stored. |
| `store` | `ConsentStore` | | **Required.** Where records are appended. |
| `policyVersion` | `string` | | **Required.** The privacy policy version the visitor saw, such as `'3.2'`. |
| `categories` | `(keyof ConsentCategories)[]` | `[]` | The custom categories passed to `createAnalytics({ categories })`. Each must be a boolean in the request. |
| `userId` | `(request: Request) => string \| undefined \| Promise<string \| undefined>` | | The signed-in user, from your session. Never read from the request body. |
| `cookie` | `string` | `'consentlayer_proof'` | The cookie name. |
| `onError` | `(error: unknown) => void` | | Receives store errors and any unexpected error. |

The record's `consentId` is taken from a valid existing cookie, else generated
with `crypto.randomUUID()`. The cookie is set with
`Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax; Secure` (400 days).
`Secure` is left out when the request's host is `localhost`, `127.0.0.1` or
`[::1]`, because Safari does not store `Secure` cookies on `http://localhost`.

| Status | When |
|---|---|
| `204` | The record was appended; the response sets the cookie. |
| `400` | Empty body, invalid JSON, or a `consent` with a missing or non-boolean category. |
| `403` | Neither `Origin` nor `Referer` is present, the `Referer` is malformed, or the origin differs from the request URL's. |
| `413` | The body exceeds 4 KiB. |
| `415` | The `Content-Type` is not `application/json`. |
| `500` | `secret` is unset or shorter than 32 characters (checked first, so no record is stored), the store threw, or another error occurred; `onError` is called. |

### `readConsentCookie(request, options)`

Verifies the cookie set by `createConsentHandler`.

```ts
function readConsentCookie(request: Request, options: ConsentCookieOptions): Promise<ConsentProof | null>
```

| Option | Type | Default | Description |
|---|---|---|---|
| `secret` | `string \| undefined` | | **Required.** The secret given to `createConsentHandler`. |
| `cookie` | `string` | `'consentlayer_proof'` | The cookie name. |

**Returns** `{ consentId, consent, policyVersion }`, or `null` when the cookie
is missing, malformed or its signature does not match, or when `secret` is
unset or shorter than 32 characters. Never throws.

### Consent stores

Each returns a `ConsentStore` for `createConsentHandler({ store })`. Table
schemas are in [Consent records](/guides/consent-records/).

| Function | Writes |
|---|---|
| `postgresStore(sql)` | One row into `consent_records (consent_id, created_at, consent, policy_version, user_id)`, through any `sql` tagged template: postgres.js, Neon or Vercel Postgres. The table name is fixed. |
| `supabaseStore(client, options?)` | One row into `options.table`, default `'consent_records'`, with the same snake_case columns. Throws when Supabase returns an error. |
| `prismaStore(model)` | `model.create({ data })` with the record's camelCase fields; `userId` is `null` when absent. Pass the model, such as `prisma.consentRecord`. |
| `drizzleStore(db, table)` | `db.insert(table).values(…)` with the record's camelCase fields; `userId` is `null` when absent. |
| `upstashStore(redis, options?)` | `RPUSH` of the JSON record onto `` `${options.prefix}${consentId}` ``. `prefix` defaults to `'consent:'`. Works with Upstash Redis and Vercel KV. |

<details>
<summary>Type signatures</summary>

```ts
function postgresStore(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<unknown>,
): ConsentStore

function supabaseStore(
  supabase: { from(table: string): { insert(row: object): PromiseLike<{ error: unknown }> } },
  options?: { table?: string },
): ConsentStore

function prismaStore(model: { create(args: { data: object }): PromiseLike<unknown> }): ConsentStore

function drizzleStore<Table>(
  db: { insert(table: Table): { values(row: object): PromiseLike<unknown> } },
  table: Table,
): ConsentStore

function upstashStore(
  redis: { rpush(key: string, ...values: string[]): Promise<unknown> },
  options?: { prefix?: string },
): ConsentStore
```

</details>

### Consent records

<details>
<summary>Type signatures</summary>

```ts
/** One row of the consent log. Rows are only ever appended. */
type ConsentRecord = {
  consentId: string
  createdAt: Date
  consent: ConsentState
  policyVersion: string
  userId?: string
  /** Sent again by the browser after the consent cookie was lost, not chosen at `createdAt`. */
  restored: boolean
}

interface ConsentStore {
  append(record: ConsentRecord): Promise<void>
}

/** What the signed cookie proves: this browser's latest recorded choice. */
type ConsentProof = {
  consentId: string
  consent: ConsentState
  policyVersion: string
}

type ConsentCookieOptions = {
  secret: string | undefined
  cookie?: string
}
```

</details>

### Destinations

A destination sends server events to one vendor.

<details>
<summary>Type signatures</summary>

```ts
interface ServerDestination<Forward extends boolean = boolean> {
  id: string
  requiredConsent: keyof ConsentState
  /** Whether createAnalyticsHandler may send browser events to it. */
  forwardBrowserEvents: Forward
  /** Throws when the vendor rejects the event. */
  send(event: ServerEvent, request?: ServerRequestInfo): Promise<void>
}

type ServerRequestInfo = {
  ip?: string
  userAgent?: string
  cookies: Record<string, string>
}

type ServerSendResult = { id: string; ok: boolean; error?: unknown }
```

`createAnalyticsHandler` fills `ServerRequestInfo` with
[`requestInfo(request)`](#requestinforequest).

</details>

## `consentlayer/server/meta`

### `metaCapi(options)`

The Meta Conversions API. It accepts browser events, which Meta deduplicates
against the pixel by event ID. Email, phone and user ID are SHA-256 hashed
before sending; `_fbp` and `_fbc` are read from the request's cookies.

```ts
function metaCapi(options: {
  pixelId: string | undefined
  accessToken: string | undefined
  testEventCode?: string
  apiVersion?: string
  fetchImpl?: typeof fetch
}): ServerDestination<true> | undefined
```

| Option | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | | **Required.** |
| `accessToken` | `string \| undefined` | | **Required.** The Conversions API access token. |
| `testEventCode` | `string` | | Sends events to Test Events in Events Manager. |
| `apiVersion` | `string` | `'v26.0'` | The Graph API version. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | The `fetch` implementation. |

**Returns** `undefined` while `pixelId` or `accessToken` is unset, empty or
only whitespace (both are trimmed), so
the destination is off. When exactly one of the two is set, which usually means
a missing variable, it also calls `console.warn` once; with both unset it is
silent. Otherwise it returns a destination with `id` `'meta'` and `requiredConsent`
`'marketing'`. Its `send` throws `Error('Meta CAPI <status>: <body>')` on a
non-2xx response.

## `consentlayer/server/tiktok`

### `tiktokEvents(options)`

The TikTok Events API. It accepts browser events, which TikTok deduplicates
against the pixel by event name and event ID, and skips `page_view`, which the
pixel sends without an ID. Email, phone (including its `+`) and user ID are
SHA-256 hashed before sending; `_ttp` and `ttclid` are read from the request's
cookies.

```ts
function tiktokEvents(options: {
  pixelId: string | undefined
  accessToken: string | undefined
  testEventCode?: string
  fetchImpl?: typeof fetch
}): ServerDestination<true> | undefined
```

| Option | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | | **Required.** |
| `accessToken` | `string \| undefined` | | **Required.** The Events API access token. |
| `testEventCode` | `string` | | Sends events to Test Events in Events Manager. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | The `fetch` implementation. |

**Returns** `undefined` while `pixelId` or `accessToken`, both trimmed, is
unset or empty, and calls `console.warn` once when exactly one of the two is
set. Otherwise it returns a destination with `id` `'tiktok'` and
`requiredConsent` `'marketing'`. Its `send` throws
`Error('TikTok Events API <status or code>: <message>')` on a non-2xx response
or a response whose `code` is not `0`.

## `consentlayer/server/ga4`

### `ga4Server(options)`

The GA4 Measurement Protocol, for server-only events such as webhooks. It
supplements gtag.js rather than replacing it, so it does not accept browser
events and `createAnalyticsHandler` does not take it. Use it with
[`sendServerEvent`](#sendservereventevent-options).

```ts
function ga4Server(options: {
  measurementId: string | undefined
  apiSecret: string | undefined
  fetchImpl?: typeof fetch
}): ServerDestination<false> | undefined
```

| Option | Type | Default | Description |
|---|---|---|---|
| `measurementId` | `string \| undefined` | | **Required.** |
| `apiSecret` | `string \| undefined` | | **Required.** A Measurement Protocol API secret. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | The `fetch` implementation. |

**Returns** `undefined` while `measurementId` or `apiSecret`, both trimmed, is unset or
empty, and calls `console.warn` once when exactly one of the two is set.
Otherwise it returns a destination with `id` `'ga4'` and `requiredConsent`
`'analytics'`. Hashed email and phone are sent only with marketing consent.
Its `send` throws when there is neither `event.clientId` nor a `_ga` cookie in
`request.cookies`, and `Error('GA4 Measurement Protocol <status>: <body>')` on
a non-2xx response.

## `consentlayer/sentry/server`

Requires the optional peer dependency `@sentry/nextjs`.

### `sentryInstrumentation(options)`

Sentry for Next.js server and edge code, configured to collect no personal
data: no user info, cookies, headers, bodies or query strings.

```ts
function sentryInstrumentation(options: SentryServerOptions): {
  register: () => void
  onRequestError: typeof captureRequestError
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `dsn` | `string \| undefined` | | **Required** key. When `undefined`, `register` does nothing. |
| `environment` | `string` | | Passed to `Sentry.init`. |
| `release` | `string` | | Passed to `Sentry.init`. |
| `tracesSampleRate` | `number` | off | The performance tracing sample rate. |

**Returns** `register`, which calls `Sentry.init`, and `onRequestError`, which
is `captureRequestError` from `@sentry/nextjs`.

```ts title="instrumentation.ts"
import { sentryInstrumentation } from 'consentlayer/sentry/server'

export const { register, onRequestError } = sentryInstrumentation({
  dsn: process.env.SENTRY_DSN,
})
```

## `consentlayer/sentry/next`

### `withSentryConfig`

Re-exports `withSentryConfig` from `@sentry/nextjs/config`, so
`next.config.ts` can import it without importing the full Sentry SDK.
Requires the optional peer dependency `@sentry/nextjs`; its signature and
options are those of `@sentry/nextjs`.

## `consentlayer/testing`

### `checkPlugin(plugin)`

Runs a plugin through its lifecycle and reports contract violations. Requires
a DOM test environment such as jsdom or happy-dom. See
[Writing a plugin](/internals/plugins/).

```ts
function checkPlugin(plugin: AnalyticsPlugin): Promise<string[]>
```

It boots the plugin with every category denied, calls `page`, `track`,
`identify` and `group`, grants every category, calls them again, then calls
`reset` and denies every category. While it runs, `globalThis.fetch` is
replaced with a stub that counts requests.

**Returns** a list of problems; `[]` means the plugin passed. When
`requiredConsent` is set and is not `'none'`, the plugin fails if, before
consent, it added a `<script src>` (unless `loadBeforeConsent` is `true`),
called `fetch`, or changed `document.cookie`. Any exception thrown by a hook
is also a problem.
