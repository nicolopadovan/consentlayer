---
title: API reference
description: Every option, method, hook, component and route handler consentlayer exports.
---

This page lists the public API, grouped by entry point. Every option is
optional unless it is marked **required**. The guides explain when to use
each part; this page is for looking things up.

## `createAnalytics(options)`

From `consentlayer`. Creates the analytics instance. Create one per page.

| Option | Type | Description |
|---|---|---|
| `providers` | `AnalyticsPlugin[]` | The providers to run. See [Providers](/guides/providers/). |
| `consent` | object | Consent settings; see [below](#consent-options). |
| `categories` | `string[]` | Your own consent categories. See [Custom categories](/guides/consent-ui/#custom-categories). |
| `names` | `NamesInput` | Storage keys, globals and event names. See [Names](/guides/names/). |
| `autoTracking` | `boolean \| AutoTrackingConfig` | Track clicks, scroll depth, time on page and page views without code. Off by default; see [below](#autotracking). |
| `server.endpoint` | `string` | Also post every event to this route. See [Server-side tracking](/guides/server-side-tracking/). |
| `server.consentEndpoint` | `string` | Post every consent choice to this route. See [Consent records](/guides/consent-records/). |
| `errors` | `boolean \| { globalHandlers?: boolean }` | `false` turns off error reporting. `{ globalHandlers: false }` keeps `captureError` but stops listening to window errors. Default `true`. |
| `enabled` | `boolean \| () => boolean` | `false` turns every provider off, for example outside production. Default `true`. |
| `debug` | `boolean` | Log consent changes and errors to the console. |
| `onError` | `(error: AnalyticsError) => void` | Receives every error, with a `scope` such as `provider-load` or `server-forward`. |
| `identityStorage` | `IdentityStorageAdapter` | Where the user identity is kept. Default: `localStorage`. |

### Consent options

`createAnalytics({ consent: { … } })`:

| Option | Type | Description |
|---|---|---|
| `adapters` | `ConsentIntegrationAdapter[]` | External consent sources, such as `createShopifyCustomerPrivacyAdapter()`. |
| `storage` | `ConsentStorageAdapter` | Where the choice is stored. Default: `localStorage`, under the consent storage key. |
| `initialConsent` | `ConsentState \| null` | Consent to start with before anything is read. |
| `broadcast` | `{ eventName?, globalKey? }` | The DOM event and window global that announce consent changes. Default: the configured names. |
| `onError` | `(error) => void` | Errors from storage and adapters. |

### `autoTracking`

`true` turns everything on with the defaults. Pass an object to choose:

| Field | Type | Description |
|---|---|---|
| `pageViews` | `boolean` | Send a page session event on each new page. |
| `clicks` | `boolean \| { mode?, attribute?, selectors? }` | `mode: 'all'` tracks clicks on elements matching `selectors`; `'attribute'` only on elements with `attribute`. |
| `scroll` | `boolean \| { thresholds?: number[] }` | Scroll depths, in percent, that send an event. |
| `timeOnPage` | `boolean \| { intervals?: number[] }` | Seconds on the page that send an event. |
| `only` | `string[]` | Send automatic events only to these provider IDs. |

Automatic events start once analytics consent is granted. Their names are in
[Names](/guides/names/).

## The analytics instance

What `createAnalytics()` returns.

| Method | Description |
|---|---|
| `boot()` | Starts the providers that consent allows and delivers the calls made before. `<AnalyticsProvider>` calls it for you. |
| `track(name, params?, options?)` | Sends an event. See [Events and identity](/guides/events/). |
| `page(payload?, { only? })` | Sends a page view. `payload` is `{ url?, path?, title? }`, read from the page when omitted. |
| `identify(userId?, traits?)` | Sets the user ID and traits. `email` and `phone` in `traits` are used only with marketing consent. |
| `reset()` | Forgets the user, for example on logout. |
| `group(id, traits?)` | Associates the user with a group, such as a company. |
| `captureError(error, context?)` | Reports an error. `context` is `{ level?, tags?, extra?, source? }`. |
| `newPageSession()` | Starts a new page session for automatic events. |
| `registerProvider(plugin)` | Adds a provider after creation. Returns a function that removes it. |
| `getSnapshot()` | Returns `{ booted, consent, activeProviders }`. |
| `subscribe(listener)` | Calls `listener` with the snapshot when it changes. Returns an unsubscribe function. |
| `destroy()` | Stops every provider and removes listeners. |

### `track` options

| Option | Type | Description |
|---|---|---|
| `eventId` | `string` | The event ID shared with the server for deduplication. Generated when omitted. |
| `only` | `string[]` | Send only to these provider IDs. |
| `providers` | `Record<string, object>` | Extra params for one provider, keyed by its ID. |
| `requireAnalyticsConsent` | `boolean` | Drop the event unless analytics is granted. |
| `requireMarketingConsent` | `boolean` | Drop the event unless marketing is granted. |

### `analytics.consent`

| Member | Description |
|---|---|
| `getConsent()` | The current choice, or `null` before the visitor has made one. |
| `update(partial)` | Changes some categories; the others keep their value. |
| `setConsent(consent)` | Replaces the whole choice. Every category must be a boolean. |
| `subscribe(listener)` | Calls `listener` with `{ consent }` on every change. Returns an unsubscribe function. |
| `bootstrap()` | Reads the stored choice. `<AnalyticsProvider>` calls it for you. |
| `categories` | Every category, built-in ones first. |

### Other exports from `consentlayer`

| Export | Description |
|---|---|
| `definePlugin(plugin)` | Types a provider you write. See [Writing a plugin](/internals/plugins/). |
| `loadScript(src, attributes?)` | Adds a script tag once and resolves when it has loaded. |
| `getFlag(name)`, `setFlag(name, value)` | Read and write a window flag under the configured prefix. |
| `getNames()` | The names in use. |
| `createEnvConfig(env)` | Reads the environment variables [below](#createenvconfig) into one object. |
| `createLocalStorageConsentStorage({ key })`, `createMemoryConsentStorage()` | Consent storage for `consent.storage`. |
| `createLocalStorageIdentityStorage({ key })`, `createMemoryIdentityStorage()` | Identity storage for `identityStorage`. |

The package also exports its types, including `Analytics`, `AnalyticsPlugin`,
`ConsentState`, `ConsentCategory`, `StandardEvents` and `TrackEventOptions`.

### `createEnvConfig`

`createEnvConfig(process.env)` returns `{ runtimeEnabled, debug, ga4, meta,
hotjar, shopify, server }` from these variables:

| Variable | Read into |
|---|---|
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `runtimeEnabled`, which is also `true` when `NODE_ENV` is `production` |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | `debug` |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | `ga4.measurementId` |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`, `NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT` | `meta.pixelId`, `meta.noscriptEnabled` |
| `NEXT_PUBLIC_HOTJAR_SITE_ID`, `NEXT_PUBLIC_HOTJAR_VERSION` | `hotjar.siteId`, `hotjar.version` |
| `NEXT_PUBLIC_SHOPIFY_STORE_ID`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN` | `shopify.storeId`, `shopify.storefrontDomain`, `shopify.storefrontAccessToken` |
| `META_TOKEN`, `FACEBOOK_TEST_EVENT_CODE`, `GA4_API_SECRET` | `server.metaToken`, `server.facebookTestEventCode`, `server.ga4ApiSecret` |

In Next.js browser code, pass each `NEXT_PUBLIC_*` variable by its full name
(`{ NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID }`),
because Next.js inlines only literal reads.

## Providers

Each from `consentlayer/providers/<name>`. See [Providers](/guides/providers/)
for what each one does. Every provider also accepts `defer`.

| Factory | Options |
|---|---|
| `ga4(options)` | `measurementId` (**required**), `loadBeforeConsent` |
| `meta(options)` | `pixelId` (**required**), `locale`, `loadBeforeConsent` |
| `posthog(options)` | `apiKey` (**required**), `apiHost`, `uiHost`, `cookieless`, `autocapture`, `recording`, `errors`, `groupType` |
| `sentry(options)` | `dsn` (**required**), `environment`, `release`, `replay`, `tracing`, `tunnel` |
| `contentsquare(options)` | `tagId` (**required**) |
| `vercel(options)` | `trackEvent` (**required**, from `@vercel/analytics`) |
| `tiktok()` | none |
| `hotjar(options)` (deprecated) | `siteId`, `version` (both **required**), `reloadOnRevoke` |
| `createShopifyCustomerPrivacyAdapter(options?)` | `loadFeature`, `canBootstrap`, `headlessStorefront: { storefrontAccessToken?, checkoutRootDomain?, storefrontRootDomain? }` |
| `getShopifyCustomerPrivacyScriptUrl()` | Returns the URL of Shopify's consent script. |

## React

From `consentlayer/react`.

### `<AnalyticsProvider>`

| Prop | Type | Description |
|---|---|---|
| `analytics` | `Analytics` | **Required.** The instance. |
| `routeKey` | `string` | Changes on every navigation; a page view is sent once per key. |
| `page` | `{ url?, path?, title? }` | Overrides the page view's details. |
| `boot` | `{ mode?, timeoutMs? }` | When providers load: `'immediate'` (default), `'idle'` or `'manual'`. `timeoutMs` defaults to 3000. |
| `autoShowBanner` | `boolean` | Show the banner when there is no stored choice. Default `true`. |
| `openConsentGlobalKey` | `string` | The window function that opens the settings. Default: the configured name. |

### Hooks

| Hook | Returns |
|---|---|
| `useAnalytics()` | The instance from `<AnalyticsProvider>`, or the last one `createAnalytics()` created. |
| `useConsent()` | `{ consent, update, setConsent, engine }`. Re-renders when consent changes. |
| `useConsentController()` | The banner's state and actions. Needs `<AnalyticsProvider>` above it. |

`useConsentController()` returns:

| Field | Description |
|---|---|
| `ready` | `true` once the stored choice has been read. |
| `error` | The bootstrap error message, or `null`. |
| `bannerVisible`, `showBanner()`, `hideBanner()` | The banner's visibility. |
| `dialogVisible`, `openDialog()`, `closeDialog()` | The settings dialog's visibility. |
| `prefs`, `setPrefs(prefs)` | The dialog's toggles, one per category. |
| `acceptAll()`, `rejectNonEssential()`, `savePreferences()` | Store a choice and close the banner and dialog. |

### Components

| Export | Description |
|---|---|
| `<ErrorBoundary fallback analytics? tags?>` | Reports render errors with `captureError` and renders `fallback`: a node, or a function of `{ error, reset }`. |
| `createGlobalError(analytics, render?)` | Builds a Next.js `global-error.tsx` component. |
| `<MetaPixelNoscript pixelId enabled?>` | The Meta pixel's `<noscript>` image, for visitors without JavaScript. |

## Ecommerce

From `consentlayer/ecommerce`. Each builds GA4-style params from storefront
shapes; prices are `{ amount, currencyCode }`.

| Function | Input | For |
|---|---|---|
| `productParams(product)` | `{ id, variantId?, title?, vendor?, category?, price?, quantity? }` | `view_item`, `add_to_cart`, `add_to_wishlist` |
| `cartParams(cart)` | `{ lines, subtotal? }` | `begin_checkout` |
| `orderParams(order)` | `{ orderId, value, currency, lines, tax?, shipping?, coupon? }` | `purchase` |
| `toItem(product)` | a product | one `items[]` entry |

## Server

From `consentlayer/server`. Every handler is a web-standard
`(Request) => Promise<Response>`.

### `createAnalyticsHandler(options)`

Receives the browser's events and forwards them. See
[Server-side tracking](/guides/server-side-tracking/).

| Option | Type | Description |
|---|---|---|
| `destinations` | `ServerDestination[]` | **Required.** For example `metaCapi(…)`. |
| `consentCookie` | `{ secret, cookie? }` | Trust only the consent in the signed cookie. |
| `onError` | `(error) => void` | Vendor and validation errors. |

### `sendServerEvent(event, options)`

Sends one event from the server, for example from a webhook. `event` is
`{ name, consent, id?, params?, identity?, url?, clientId?, only?, providers? }`;
`options` is `{ destinations, request? }`. Resolves to
`{ id, ok, error? }[]`, one entry per destination.

### `createConsentHandler(options)`

Records each consent choice and signs a cookie. See
[Consent records](/guides/consent-records/).

| Option | Type | Description |
|---|---|---|
| `secret` | `string` | **Required.** Signs the cookie. At least 32 characters. |
| `store` | `ConsentStore` | **Required.** Where records are appended. |
| `policyVersion` | `string` | **Required.** The privacy policy the visitor saw. |
| `categories` | `string[]` | Your custom categories. |
| `userId` | `(request) => string \| undefined` | The signed-in user, from your session. |
| `cookie` | `string` | The cookie's name. Default `consentlayer_proof`. |
| `onError` | `(error) => void` | Store errors. |

`readConsentCookie(request, { secret, cookie? })` returns the verified
`{ consentId, consent, policyVersion }`, or `null`.

Stores: `postgresStore(sql)`, `supabaseStore(client, { table? })`,
`prismaStore(model)`, `drizzleStore(db, table)` and
`upstashStore(redis, { prefix? })`.

### Destinations

| Factory | Import from | Options |
|---|---|---|
| `metaCapi(options)` | `consentlayer/server/meta` | `pixelId`, `accessToken` (both **required**), `testEventCode`, `apiVersion`, `fetchImpl` |
| `ga4Server(options)` | `consentlayer/server/ga4` | `measurementId`, `apiSecret` (both **required**), `fetchImpl` |

`ga4Server` sends server-only events and can't be passed to
`createAnalyticsHandler`.

## Sentry for Next.js

| Export | Import from | Description |
|---|---|---|
| `sentryInstrumentation({ dsn, environment?, release?, tracesSampleRate? })` | `consentlayer/sentry/server` | Returns `{ register, onRequestError }` for `instrumentation.ts`. Sends no personal data. |
| `withSentryConfig(config, options)` | `consentlayer/sentry/next` | `@sentry/nextjs`'s config wrapper. |

## Testing

`checkPlugin(plugin)` from `consentlayer/testing` runs a plugin through its
lifecycle in a DOM test and resolves to a list of problems; an empty list
means it passed.
