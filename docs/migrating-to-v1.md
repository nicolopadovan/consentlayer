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
| `defaultEventDestinations`, `sendTo` | every provider by default; `only: [...]` per event |
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
| `trackCustomizeProduct(product)` | `track('customize_product', productParams(product))` (custom event) |
| `trackEvent('ViewContent', …)` etc. | the standard name: Meta still receives `ViewContent` |

`productParams`, `cartParams` and `orderParams` come from
`@nicolopadovan/analytics-consent-manager/ecommerce`. `cartParams` reads
`lines` as products (`{ id, variantId, title, price, quantity }`); map Shopify
cart lines' `merchandise` to that shape.

What reaches each provider:

- **GA4** now gets ecommerce events under GA4's names with `items[]`, instead
  of `ViewContent` with `product_id`. Rebuild reports that used the old names.
- **Meta** gets the same standard events as before, with `content_ids` /
  `contents` instead of `product_id` / `variant_id`.
- `eventId` is generated for every event and passed to every provider.

### Provider adapters you wrote

- `event.id` is the event ID (it used to be `event.options.eventId ?? createEventId()`).
  `metaEventIdFrom()` is removed.
- `event.options.sendTo` is now `only`; `providers[yourId]` holds extras meant for you.
- New optional hooks: `identify(identity, traits, ctx)`, `reset(ctx)`, `group(id, traits, ctx)`.
- `ctx.identity` is `{ userId?, email?, phone? }` (was `external_id`).
