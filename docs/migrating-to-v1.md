# Migrating to v1

v1 ships in stages, each as its own release candidate. This guide gains a
section per stage. The design is in [spec-v1.md](./spec-v1.md).

## 1.0.0-rc.2: names, one instance, standard events

### Names (`acm` → `npcm`)

Nothing to do unless you read the names yourself. Stored `acm_*` values move
to `npcm_*` on first read, and the old globals, DOM events, classes and CSS
variables keep working. Two things do change:

- Auto-tracking events are now `npcm.*`. Update dashboards that filter on `acm.*`.
- GA4 receives them as `npcm_page_session_start`, `npcm_scroll_depth`,
  `npcm_time_on_page` and `npcm_ui_click`, because GA4 rejects dots in event names.

### Setup: one instance

Before:

```tsx
const consentEngine = createConsentEngine({ storage, adapters, broadcast })
const identityStorage = createLocalStorageIdentityStorage({ key })
const manager = createAnalyticsManager({ consentEngine, identityStorage, defaultEventDestinations })
manager.registerProvider(createGa4Adapter({ measurementId }))
setDefaultConsentEngine(consentEngine)
setDefaultIdentityStorage(identityStorage)
setDefaultRuntimeAnalyticsManager(manager)

<ConsentProvider engine={consentEngine}>
  <ConsentControllerProvider>
    <AnalyticsManager manager={manager} lazy={lazy} routeKey={routeKey} />
    <AutoTracking manager={manager} routeKey={routeKey} />
    {children}
  </ConsentControllerProvider>
</ConsentProvider>
```

After:

```tsx
const analytics = createAnalytics({
  providers: [createGa4Adapter({ measurementId })],
  consent: { adapters },          // e.g. createShopifyCustomerPrivacyAdapter()
  autoTracking: true,             // or an AutoTrackingConfig
})

<AnalyticsProvider analytics={analytics} boot={lazy} routeKey={routeKey}>
  {children}
</AnalyticsProvider>
```

Storage keys and broadcast default to the configured names, so most apps can
drop their `storage` and `broadcast` options.

| Removed | Use instead |
|---|---|
| `createAnalyticsManager`, `createConsentEngine` | `createAnalytics()` |
| `registerProvider(adapter)` (module function) | `providers: [...]`, or `analytics.registerProvider()` |
| `setDefault*` / `getDefault*`, `useDefaultIdentityStorage` | the instance |
| `defaultEventDestinations`, `sendTo` | every provider by default; `only: [...]` per event, `autoTracking: { only: [...] }` for auto-tracked events |
| `<ConsentProvider>`, `<ConsentControllerProvider>`, `<AnalyticsManager>`, `<AutoTracking>` | `<AnalyticsProvider>` |
| `<AnalyticsManager lazy>` | `<AnalyticsProvider boot>` |
| `useTracker()` | `useAnalytics()` |
| `updateConsent(consent)` | `analytics.consent.update(partial)` or `useConsent().update` |
| `trackEvent(name, params)`, `trackPage()` | `analytics.track(name, params)`, `analytics.page()` |
| `enableAutoTracking()`, `newPageSession()` | `autoTracking` option; `AnalyticsProvider` handles route changes |
| `saveIdentity({ email, external_id })`, `getIdentity()` | `analytics.identify(userId, { email, phone, ...traits })`; `analytics.reset()` on logout |

`useConsent()` and `useConsentController()` still exist and now require
`AnalyticsProvider` above them.

### Events

Event names are GA4-style and each provider translates them, so stop using
Meta names. See [events and identity](./events.md).

| Before | After |
|---|---|
| `trackViewContent(product)` | `track('view_item', productParams(product))` |
| `trackAddToCart(item)` | `track('add_to_cart', productParams(item))` |
| `trackAddToWishlist(item)` | `track('add_to_wishlist', productParams(item))` |
| `trackInitiateCheckout(cart)` | `track('begin_checkout', cartParams(cart))` |
| `trackInitiateCheckout(product)` (buy now) | `track('begin_checkout', cartParams({ lines: [product] }))` |
| `trackAddPaymentInfo({ value, currency })` | `track('add_payment_info', { value, currency })` |
| `trackPurchase(order)` | `track('purchase', orderParams(order))` |
| `trackLead(params)` | `track('lead', params)` |
| `trackSearch(query)` | `track('search', { search_term: query })` |
| `trackContact(method)` | `track('contact', { method })` |
| `trackSubscribe(email)` | `identify(undefined, { email })` then `track('subscription_started')` or a custom `track('newsletter_signup')` |
| `trackCustomizeProduct(product)` | `track('customize_product', productParams(product))` |
| `trackEvent('ViewContent', …)` etc. | the standard name: Meta still receives `ViewContent` |

`productParams`, `cartParams` and `orderParams` come from
`@nicolopadovan/analytics-consent-manager/ecommerce`. `cartParams` reads
`lines` as products (`{ id, variantId, title, price, quantity }`); map Shopify
cart lines' `merchandise` to that shape.

What reaches each provider:

- **GA4** now gets ecommerce events under GA4's names with `items[]`, instead
  of `ViewContent` with `product_id`. Rebuild reports that used the old names.
- **Meta** gets the same standard events as before, with `content_ids` /
  `contents` (the variant ID when there is one, else the product ID) instead
  of `product_id` / `variant_id`. A Meta standard name passed as is
  (`track('Schedule')`) is still sent as a standard event.
- `track` no longer requires analytics consent on top of each provider's own
  consent: Meta now receives events with marketing consent alone. Pass
  `requireAnalyticsConsent: true` to keep the old gate.
- `eventId` is generated for every event and passed to every provider.

### Provider adapters you wrote

- `event.id` is the event ID (it used to be `event.options.eventId ?? createEventId()`).
  `metaEventIdFrom()` is removed.
- `event.options.sendTo` is now `only`; `providers[yourId]` holds extras meant for you.
- New optional hooks: `identify(identity, traits, ctx)`, `reset(ctx)`, `group(id, traits, ctx)`.
- `ctx.identity` is `{ userId?, email?, phone? }` (was `external_id`). Identities
  stored under `external_id` are read as `userId`.

### Without React

Call `analytics.consent.bootstrap()` once at startup to load stored consent,
then `analytics.boot()`. `AnalyticsProvider` does both.

## 1.0.0-rc.3: plugin contract and server

### Provider factories

| Before | After |
|---|---|
| `createGa4Adapter(options)` | `ga4(options)` |
| `createMetaAdapter(options)` | `meta(options)` |
| `createHotjarAdapter(options)` | `hotjar(options)` |
| `createShopifyAnalyticsAdapter(options)` | `shopify(options)` |
| `createTikTokConsentAdapter()` | `tiktok()` |
| `createVercelAdapter(options)` | `vercel(options)` |

Options are unchanged. `vercel()` now runs without consent, because Vercel
Analytics sets no cookies; pass `{ ...vercel(options), requiredConsent: 'analytics' }` to keep
the old gate.

### Plugins you wrote

Wrap the object in `definePlugin()` (from the package root) and rename hooks:

| Before | After |
|---|---|
| `ProviderAdapter`, `AnalyticsProviderContext` | `AnalyticsPlugin`, `PluginContext` |
| `init(ctx)` | `load(ctx)`: inject scripts here; runs once |
| `onConsentChange(ctx)` | `consent(ctx)` |
| `trackPage(payload, ctx)` | `page(page, ctx)`; `page.id` is the page view's event ID |
| `trackEvent(event, ctx)` | `track(event, ctx)` |
| `enabled(ctx)` / `consentLatch()` | `loadBeforeConsent: false` (the default for plugins) |
| `ctx.isBooted` | removed: hooks run only after boot |

`setup` must not touch the network or cookies; it runs at boot before
consent. Without `requiredConsent` a plugin now runs with no consent at all
(`'none'`). Error scopes are renamed to match: `provider-load`,
`provider-consent`, `provider-page`, `provider-track`.

Check a plugin in a DOM test:

```ts
import { checkPlugin } from '@nicolopadovan/analytics-consent-manager/testing'

expect(await checkPlugin(posthog({ apiKey }))).toEqual([])
```

### Server routes

One route replaces the hand-written Meta and GA4 routes:

```ts
// app/api/analytics/route.ts
import { createAnalyticsHandler } from '@nicolopadovan/analytics-consent-manager/server'
import { metaCapi } from '@nicolopadovan/analytics-consent-manager/server/meta'

export const runtime = 'nodejs'
export const POST = createAnalyticsHandler({
  destinations: [metaCapi({ pixelId, accessToken: process.env.META_TOKEN! })],
})
```

| Before | After |
|---|---|
| `meta({ pixelId, serverEndpoint, fetchImpl })` | `meta({ pixelId })` + `createAnalytics({ server: { endpoint: '/api/analytics' } })` |
| Route calling `createMetaEventPayload` + `sendMetaCapiEvent` | `createAnalyticsHandler({ destinations: [metaCapi(…)] })` |
| Route forwarding browser events to GA4 with `sendGa4MeasurementEvent` | delete it: gtag already sends them. Use `sendServerEvent` with `ga4Server(…)` for webhook events only |

The browser now posts `{ id, name, params, consent, identity, url, only,
providers }`, so an old route won't understand it. Forwarding now covers
page views and every destination, not only Meta's `track` calls. The
low-level helpers are still exported. See
[server-side tracking](./server-side-tracking.md).
