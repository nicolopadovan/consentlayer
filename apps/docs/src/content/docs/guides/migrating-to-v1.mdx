---
title: Upgrading to 1.0
description: Move from @nicolopadovan/analytics-consent-manager to consentlayer 1.0.
---

consentlayer 1.0 replaces `@nicolopadovan/analytics-consent-manager`. The
setup shrinks to one `createAnalytics()` call and one `<AnalyticsProvider>`,
event names follow GA4, and providers and plugins get shorter names. This page
walks through each change by topic.

## Install the new package

```bash
pnpm remove @nicolopadovan/analytics-consent-manager
pnpm add consentlayer
```

Replace `@nicolopadovan/analytics-consent-manager` with `consentlayer` in your
imports, and delete the `@nicolopadovan:registry` line from `.npmrc`.

`react` and `react-dom` are now optional peer dependencies. Install
`posthog-js`, `@sentry/browser` or `@sentry/nextjs` only if you use them (see
[Installation](/start/installation/#provider-sdks)).

## Create one instance

The engine, the manager, the module-level defaults and four React components
become one instance and one provider.

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
// lib/analytics.ts
export const analytics = createAnalytics({
  providers: [ga4({ measurementId })],
  consent: { adapters },          // e.g. createShopifyCustomerPrivacyAdapter()
  autoTracking: true,             // or an AutoTrackingConfig
})

<AnalyticsProvider analytics={analytics} boot={lazy} routeKey={routeKey}>
  {children}
</AnalyticsProvider>
```

Create the instance at module level, not inside a component:
`app/global-error.tsx` and code outside React import it. Storage keys and the
broadcast channel default to the configured [names](/guides/names/), so most
apps can drop their `storage` and `broadcast` options.

Without React, call `analytics.consent.bootstrap()` once at startup to load
the stored consent, then `analytics.boot()`. `AnalyticsProvider` does both.

| Removed | Use instead |
|---|---|
| `createAnalyticsManager`, `createConsentEngine` | `createAnalytics()` |
| `registerProvider(adapter)` (module function) | `providers: [...]`, or `analytics.registerProvider()` |
| `setDefault*`, `getDefault*`, `useDefaultIdentityStorage` | the instance |
| `defaultEventDestinations`, `sendTo` | every provider by default; `only: [...]` per event, or `autoTracking: { only: [...] }` for automatic events |
| `<ConsentProvider>`, `<ConsentControllerProvider>`, `<AnalyticsManager>`, `<AutoTracking>` | `<AnalyticsProvider>` |
| `<AnalyticsManager lazy>` | `<AnalyticsProvider boot>` |
| `useTracker()` | `useAnalytics()` |
| `updateConsent(consent)` | `analytics.consent.update(partial)` or `useConsent().update` |
| `trackEvent(name, params)`, `trackPage()` | `analytics.track(name, params)`, `analytics.page()` |
| `enableAutoTracking()`, `newPageSession()` | the `autoTracking` option; `AnalyticsProvider` handles route changes |
| `saveIdentity({ email, external_id })`, `getIdentity()` | `analytics.identify(userId, { email, phone, ...traits })`; `analytics.reset()` on logout |
| `configureNames()` | `createAnalytics({ names })` |
| `analytics.consent.destroy()` | `analytics.destroy()` |
| `defaultRuntimePreset`, `legacyNames` | `getNames()` |

`useConsent()` and `useConsentController()` still exist.
`useConsentController()` needs `<AnalyticsProvider>` above it; `useAnalytics()`
and `useConsent()` fall back to the instance `createAnalytics()` created. The
root entry no longer exports the validators or the engine and manager types.

## Keep the stored consent

The old package stored everything under `acm_*` names. They are off by
default, so pass `legacy: true` to carry over the consent and identity your
visitors already gave:

```ts
createAnalytics({ providers, names: { legacy: true } })
```

Stored `acm_*` values then move to `consentlayer_*` the first time they are
read, and the old globals and DOM events keep working. See
[Names](/guides/names/#migrating-from-acm_).

Automatic events are renamed either way: they are now `consentlayer.*`, and
GA4 receives them as `consentlayer_page_session_start`,
`consentlayer_scroll_depth`, `consentlayer_time_on_page` and
`consentlayer_ui_click`, because GA4 rejects dots in event names. Update
dashboards that filter on `acm.*`.

## Rename the providers

| Before | After |
|---|---|
| `createGa4Adapter(options)` | `ga4(options)` |
| `createMetaAdapter(options)` | `meta(options)` |
| `createHotjarAdapter(options)` | `hotjar(options)` |
| `createTikTokConsentAdapter()` | `tiktok()` |
| `createVercelAdapter(options)` | `vercel(options)` |
| `createShopifyAnalyticsAdapter(options)` | removed: it queued events that nothing read, so Shopify never received them |

Each is imported from `consentlayer/providers/<name>`. The options are
unchanged, with these differences in behaviour:

- `ga4()` and `meta()` no longer load before consent. To keep Consent Mode
  pings while consent is denied, pass `loadBeforeConsent: true`.
- `vercel()` now runs without consent, because Vercel Analytics sets no
  cookies. To keep the old gate, pass
  `{ ...vercel(options), requiredConsent: 'analytics' }`.
- `MetaPixelNoscript` is imported from `consentlayer/react`.

PostHog and Sentry are new built-in providers. If you wrote your own PostHog
plugin, you can replace it with `posthog({ apiKey })`. See
[Providers](/guides/providers/#posthog-and-sentry).

## Update your events

Event names now follow GA4, and each provider translates them, so stop using
Meta's names. See [Events and identity](/guides/events/).

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
| `trackSubscribe(email)` | `identify(undefined, { email })`, then `track('subscription_started')` or a custom event such as `track('newsletter_signup')` |
| `trackCustomizeProduct(product)` | `track('customize_product', productParams(product))` |
| `trackEvent('ViewContent', …)` and other Meta names | the standard name; Meta still receives `ViewContent` |

`productParams`, `cartParams` and `orderParams` come from
`consentlayer/ecommerce`. `cartParams` reads `lines` as products
(`{ id, variantId, title, price, quantity }`), so map the `merchandise` of
Shopify cart lines to that shape.

What reaches each provider changes too:

- **GA4** receives ecommerce events under GA4's names with `items[]`, instead
  of `ViewContent` with `product_id`. Rebuild reports that used the old names.
- **Meta** receives the same standard events as before, with `content_ids` and
  `contents` (the variant ID when there is one, otherwise the product ID)
  instead of `product_id` and `variant_id`. A Meta standard name passed as it
  is, such as `track('Schedule')`, is still sent as a standard event.
- `track` no longer requires analytics consent on top of each provider's own
  category, so Meta now receives events with marketing consent alone. Pass
  `requireAnalyticsConsent: true` to keep the old behaviour.
- Every event gets an event ID, passed to every provider.

## Build your own banner

`consentlayer/ui` and its stylesheet are gone, along with the `locale`,
`messages` and `privacyPolicyUrl` props, `createAnalytics({ locale })` and
`names.classPrefix`. Copy the [Consent UI recipe](/guides/consent-ui/) into
your app and restyle it. If you copied the `.acm-*` markup or themed the
`--acm-*` variables, move those styles onto your component.

Two consent behaviours changed:

- "Reject non-essential" stores `preferences: false` instead of `true`. If your
  app reads `consent.preferences`, for example for a language or theme cookie,
  visitors who reject now have it off. The dialog has a Preferences toggle to
  grant it.
- `consent.setConsent()` rejects with a `TypeError` unless every category is a
  boolean. Convert values read from your own cookie or form (`'true'`, `1`)
  first; previously, `'false'` granted consent.

## Report errors

Window errors and unhandled promise rejections now go to every provider that
handles errors, such as Sentry and PostHog. Turn that off with
`createAnalytics({ errors: { globalHandlers: false } })`.

`withSentry` from `consentlayer/sentry/next` is now `withSentryConfig`. For
`ErrorBoundary` and `app/global-error.tsx`, see the
[Next.js guide](/start/nextjs/#5-report-errors).

## Replace your server routes

One route replaces the hand-written Meta and GA4 routes:

```ts
// app/api/analytics/route.ts
import { createAnalyticsHandler } from 'consentlayer/server'
import { metaCapi } from 'consentlayer/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [metaCapi({ pixelId, accessToken: process.env.META_TOKEN! })],
})
```

| Before | After |
|---|---|
| `meta({ pixelId, serverEndpoint, fetchImpl })` | `meta({ pixelId })` and `createAnalytics({ server: { endpoint: '/api/analytics' } })` |
| A route calling `createMetaEventPayload` and `sendMetaCapiEvent` | `createAnalyticsHandler({ destinations: [metaCapi(…)] })` |
| A route forwarding browser events to GA4 with `sendGa4MeasurementEvent` | delete it: gtag already sends them. Use `sendServerEvent` with `ga4Server(…)` for webhook events only |

The browser now posts `{ id, name, params, consent, identity, url, only,
providers }`, which an old route won't understand. Forwarding now covers page
views and every destination, not only Meta's `track` calls. The low-level
helpers are still exported. See
[Server-side tracking](/guides/server-side-tracking/).

## Update plugins you wrote

Wrap the object in `definePlugin()` from the package root, and rename the
types and hooks:

| Before | After |
|---|---|
| `ProviderAdapter`, `AnalyticsProviderContext` | `AnalyticsPlugin`, `PluginContext` |
| `init(ctx)` | `load(ctx)`: inject scripts here; it runs once |
| `onConsentChange(ctx)` | `consent(ctx)` |
| `trackPage(payload, ctx)` | `page(page, ctx)`; `page.id` is the page view's event ID |
| `trackEvent(event, ctx)` | `track(event, ctx)` |
| `enabled(ctx)`, `consentLatch()` | `loadBeforeConsent: false` (the default for plugins) |
| `ctx.isBooted` | removed: hooks run only after boot |
| `event.options.eventId ?? createEventId()`, `metaEventIdFrom()` | `event.id` |
| `event.options.sendTo` | `event.options.only`; `providers[yourId]` holds extras meant for your plugin |
| `ctx.identity.external_id` | `ctx.identity.userId`, next to `email` and `phone`; identities stored under `external_id` are read as `userId` |

Other changes:

- New optional hooks: `identify(identity, traits, ctx)`, `reset(ctx)` and
  `group(id, traits, ctx)`.
- `setup` must not touch the network or cookies, because it runs at boot,
  before consent.
- Without `requiredConsent`, a plugin now runs with no consent at all
  (`'none'`).
- Error scopes are renamed to match: `provider-load`, `provider-consent`,
  `provider-page` and `provider-track`.

Check a plugin in a DOM test:

```ts
import { checkPlugin } from 'consentlayer/testing'

expect(await checkPlugin(myPlugin)).toEqual([])
```

See [Writing a plugin](/internals/plugins/) for the full contract.
