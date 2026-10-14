# consentlayer

## 1.0.0-rc.2

### Patch Changes

- 15982df: Export the `StoredConsent` type from `consentlayer`, so a custom `ConsentStorageAdapter` can name the record it reads and writes.
- fefddf8: A server destination's `events` option now covers `page_view` as well, so `metaCapi({ events: ['lead'] })` no longer receives page views. `createAnalyticsHandler` answers with a `consentlayer-events` header listing the event names its destinations take, and the browser then forwards only those events, plus events with `only`, instead of every event.

## 1.0.0-rc.1

### Minor Changes

- 3bec6da: Every provider and server destination takes an `events` option: the event names `track()` sends to it, or `false` for none. Analytics providers receive every event by default. The Meta and TikTok pixels, `metaCapi` and `tiktokEvents` now receive only events that map to one of their standard events; custom and auto-tracking events reach them only when listed. An event whose `only` option names a provider is always sent to it.

  `autoTracking()` no longer takes `only`; use the providers' `events` option instead.

  Declare your own events in a `Register` interface (`declare module 'consentlayer' { interface Register { events: { … } } }`) to type their params. Once declared, `track()` rejects undeclared names.

- dfe1789: When a visitor grants marketing after analytics on the same route, the automatic page view now reaches marketing server destinations such as the Meta Conversions API, without being sent twice to those that already have it. `page()`'s `server` option accepts an array of categories, and `ServerEvent` has a `categories` field that `sendServerEvent` honors.
- dfe1789: Add a `nonce` option to `createAnalytics()`. ConsentLayer sets it on every script it injects, including the inline base code of `meta()` and `tiktok()`, for a Content Security Policy that allows scripts by nonce. The script-tag build reads it from its own `<script>` tag.
- dfe1789: `tcf()` no longer stores the denied state it reads while the CMP shows its interface, before the visitor has chosen. Consent adapters can answer `{ consent, provisional: true }` from `bootstrap()` for such a state: the engine applies it but does not store it. The new `ConsentBootstrapAnswer` type describes the answer.

### Patch Changes

- 70c4160: Updates development dependencies and fixes the lint errors the newer typescript-eslint reports. The script tag now binds `history.pushState` and `replaceState` once, with no change in behavior.

## 1.0.0-rc.0

The first public release.

### Consent

- `createAnalytics()` returns one instance with `track`, `page`, `identify`,
  `reset`, `group`, `captureError` and `consent`. Each provider runs only
  while its consent category is granted; calls made before boot are held and
  delivered in order.
- Categories `preferences`, `analytics` and `marketing`, plus typed custom
  categories declared in `ConsentCategories`.
- `createConsentController()` and each framework binding expose the state a
  banner needs; build your own banner on it.
- Re-consent after `consent.maxAgeDays` or a new major `consent.policyVersion`,
  with `onStale: 'discard' | 'keep'`.
- Global Privacy Control: while the browser sends it, `acceptAll()` leaves
  `marketing` denied; an explicit opt-in still wins. `consent.gpc: false`
  turns it off. The server follows each event's consent, which already
  reflects the signal.
- Consent records: `createConsentHandler()` appends each choice to Postgres,
  Supabase, Prisma, Drizzle or Upstash and sets a signed consent cookie, which
  `createAnalyticsHandler({ consentCookie })` uses to deny what the request
  body grants beyond it. A lost cookie is restored from the browser's stored choice.

### Consent adapters

- `tcf()` from `consentlayer/adapters/tcf` follows the choice an IAB TCF v2
  CMP collects, read-only, ahead of the stored choice.
- `shopifyCustomerPrivacy()` from `consentlayer/adapters/shopify` keeps
  Shopify's Customer Privacy API in sync, and loads it on headless
  storefronts.
- `googleConsentMode()` from `consentlayer/adapters/google-consent-mode` sends
  Consent Mode v2 signals to every Google tag, with region defaults,
  `waitForUpdate`, `urlPassthrough` and `adsDataRedaction`.

### Providers

- `ga4()`: Google Analytics 4 with Consent Mode v2, basic or advanced, and
  `serverContainerUrl` for server-side tagging.
- `gtm()`: a Google Tag Manager container, loaded after the Consent Mode
  defaults, fed page views, events, the user ID and consent changes through
  `dataLayer`. `requiredConsent` holds it until a category is granted, and
  `serverContainerUrl` loads it from your tagging server.
- `meta()`: the Meta Pixel with advanced matching and event IDs shared with
  the Conversions API.
- `tiktok()`: the TikTok Pixel with TikTok's consent mode and advanced
  matching.
- `posthog()`: cookieless until analytics consent; events, identity, groups,
  errors, and opt-in autocapture and session recording.
- `sentry()`: errors without consent or personal data; the user ID, Replay
  and tracing after analytics consent. `consentlayer/sentry/server` and
  `consentlayer/sentry/next` for Next.js.
- `contentsquare()`, `vercel()`, and `hotjar()` (deprecated in favor of
  `contentsquare()`).
- `definePlugin()` and `loadScript()` from `consentlayer`, and `checkPlugin()`
  from `consentlayer/testing`, for writing your own provider.
- Standard events with GA4 names, translated for each provider, and
  `productParams`, `cartParams` and `orderParams` in `consentlayer/ecommerce`.
- `autoTracking()` from `consentlayer/auto-tracking`: page sessions, scroll
  depth, time on page and clicks.
- `<MetaPixelNoscript>` and `<GtmNoscript>` render the vendors' `<noscript>`
  markup for visitors without JavaScript, opt-in.

### Server

- `createAnalyticsHandler()` forwards browser events to server destinations;
  `sendServerEvent()` sends server-only events such as webhooks. Both check
  the event's consent, hash email addresses and phone numbers, and run on edge runtimes.
- Destinations: `metaCapi()` (Meta Conversions API), `tiktokEvents()` (TikTok
  Events API), `sgtm()` (a server-side Google Tag Manager container) and
  `ga4Server()` (GA4 Measurement Protocol, server-only events).

### Frameworks

- `consentlayer/react` and `consentlayer/next` (App Router and Pages Router).
- `consentlayer/vue` and the `consentlayer/nuxt` module.
- `consentlayer/svelte` and `consentlayer/sveltekit`.
- `consentlayer/solid` and `consentlayer/solidstart`.
- `consentlayer/angular`.
- A script-tag build on jsDelivr and unpkg, configured with
  `window.ConsentLayer` or `data-` attributes, with an optional consent
  banner.

### Debugging

- `debug` logs consent changes, page views, events, provider lifecycle and
  errors; its object form picks topics and providers and takes your own
  logger. `onError` reports script-load failures and plugin errors.
