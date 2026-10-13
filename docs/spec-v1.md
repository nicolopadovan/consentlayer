# Spec: v1 architecture

Status: stages 1 and 2 implemented · 2026-10-13

## Goal

One package that an ecommerce store, a web app or a SaaS product drops in to:

- ask for and remember consent (built-in UI or the consumer's own);
- load and run analytics providers only as consent allows;
- track one set of events that every provider understands;
- send the same events server-side with minimal setup.

## Rules

1. **Consumers talk only to the package.** They never call `gtag`, `fbq`,
   `posthog`, `ttq`, … and never read provider globals.
2. **Every provider follows one contract** (below), whether built-in or a
   third-party plugin. Built-ins use only the public plugin API.
3. **Server-side is plug-and-play**: one route file plus credentials.

## Done when

- Every built-in provider passes one shared contract test suite.
- `apps/example-next` uses no provider globals and no provider-specific calls.
- Server-side tracking is one route file plus config.
- A migration guide covers the 9 consuming apps.

Breaking changes are allowed: the package is still a release candidate.

## Consumer API

```ts
import { createAnalytics } from '@nicolopadovan/analytics-consent-manager'
import { ga4 } from '@nicolopadovan/analytics-consent-manager/providers/ga4'
import { meta } from '@nicolopadovan/analytics-consent-manager/providers/meta'

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: 'G-…' }),
    meta({ pixelId: '…', loadBeforeConsent: false }),
  ],
  server: { endpoint: '/api/analytics' }, // optional; see Server
  autoTracking: { clicks: true, scroll: true },
  names: { prefix: 'npcm' },               // replaces configureNames()
})

analytics.track('sign_up', { method: 'google' })
analytics.identify('user_123', { email, plan: 'pro' })
analytics.reset()                           // on logout
analytics.page()                            // usually automatic
analytics.consent.update({ analytics: true, marketing: false })
```

React keeps `<AnalyticsProvider analytics={analytics}>`, `useAnalytics()`,
`useConsent()` and the UI components. They take the instance instead of
reading module-level singletons.

### Provider-specific extras

Allowed only through one typed per-event option. Providers ignore keys
that aren't theirs:

```ts
analytics.track('purchase', params, {
  providers: { meta: { content_category: 'shoes' } }, // merged into Meta's params
  only: ['ga4', 'meta'],                    // optional destination filter
})
```

Each provider merges `providers[itsId]` into the params it sends.

## Events

Standard event names follow GA4's naming because it is the most structured.
Each provider translates what it understands. Anything else is sent as a
custom event, or dropped if the provider has no custom events.

| Pack | Events |
|---|---|
| Core | `page_view`, `sign_up`, `login`, `search`, `lead`, `share`, `contact` |
| Ecommerce (`/ecommerce`) | `view_item`, `view_item_list`, `add_to_cart`, `remove_from_cart`, `add_to_wishlist`, `begin_checkout`, `add_payment_info`, `add_shipping_info`, `purchase`, `refund` |
| SaaS | `trial_started`, `subscription_started`, `subscription_cancelled`, plus `group(id, traits)` |

All standard events are typed in core (types cost nothing at runtime), so
there is no `/saas` subpath. Ecommerce events carry GA4's `items[]` shape
(`item_id`, `item_name`, `item_variant`, `price`, `quantity`,
`item_category`) plus `value` and `currency`. `/ecommerce` exports param
builders rather than `trackX()` functions, so every event goes through
`analytics.track`: `track('purchase', orderParams(order))`.

Example translations:

| Standard | GA4 | Meta | PostHog |
|---|---|---|---|
| `view_item` | `view_item` | `ViewContent` | `view_item` |
| `add_to_cart` | `add_to_cart` | `AddToCart` | `add_to_cart` |
| `purchase` | `purchase` | `Purchase` | `purchase` |
| `sign_up` | `sign_up` | `CompleteRegistration` | `sign_up` |
| `lead` | `generate_lead` | `Lead` | `lead` |
| `search` | `search` | `Search` | `search` |

Every event gets an `eventId`. The browser and the server use the same ID so
providers that dedupe (Meta) count it once.

### Identity

`identify(userId, traits)` stores the user ID and passes traits to providers
(traits are not stored). Email and phone are personal data used for ad
matching, so they follow marketing consent (GDPR / ePrivacy): kept in memory
until it is granted, then stored and shared with every provider that accepts
them; deleted from storage and memory when it is refused or withdrawn. `reset()` clears
everything. Providers receive identity through the context; they never read
storage themselves.

No package-level anonymous ID: each provider keeps its own, and the server
handler reads `_fbp` / `_fbc` / `_ga` from cookies, so forwarding doesn't need
one either.

## Consent

- Categories stay `preferences`, `analytics`, `marketing` (+ `sale_of_data`).
- `requiredConsent: 'none'` for cookieless providers (Plausible, Umami,
  PostHog cookieless mode).
- The engine, storage, broadcast and names (`configureNames`, legacy `acm_*`
  migration) stay as they are.

## Provider contract

```ts
definePlugin({
  id: 'posthog',
  requiredConsent: 'analytics',  // or 'none'; defaults to 'none'
  loadBeforeConsent?: boolean,   // load at boot, relying on the provider's consent mode
  setup(ctx),                    // no network, no cookies
  consent(ctx),                  // apply the current consent state
  load(ctx),                     // inject scripts; runs once
  identify(identity, traits, ctx),
  reset(ctx),
  group(id, traits, ctx),
  page(page, ctx),               // page.id is shared with the server
  track(event, ctx),             // receives the standard event
  teardown(ctx),                 // stop sending; remove cookies where possible
})
```

The manager, not the plugin, enforces the rules:

1. `setup` runs at boot, then `consent` at boot and on every consent change.
2. `load` runs once, after `consent`: when the category is granted, or at
   boot if the plugin sets `loadBeforeConsent` (GA4 and Meta do by default;
   the consumer turns it off with `loadBeforeConsent: false`).
3. `page`, `track`, `identify` and `group` run only while consent is granted.
   Calls made before boot are queued and delivered right after it; calls
   made later without consent are dropped, never replayed.
4. A withdrawal runs `teardown`; tracking calls are dropped until consent
   returns. A regrant doesn't run `load` again.
5. Every hook is wrapped: an error is reported through `onError` and never
   breaks other providers.

Public helpers for plugin authors: `definePlugin`, `loadScript(src, attrs)`,
`getFlag` / `setFlag`, and `checkPlugin(plugin)` from `/testing`, which every
built-in passes. `mapEvent` and `hashUserData` were dropped: a plain lookup
table does the first, and browser SDKs hash for you while server
destinations hash internally.

## Server

```ts
// app/api/analytics/route.ts
import { createAnalyticsHandler } from '@nicolopadovan/analytics-consent-manager/server'
import { metaCapi } from '@nicolopadovan/analytics-consent-manager/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [metaCapi({ pixelId, accessToken: process.env.META_CAPI_TOKEN! })],
})

// a Stripe / Shopify webhook
import { sendServerEvent } from '@nicolopadovan/analytics-consent-manager/server'
import { ga4Server } from '@nicolopadovan/analytics-consent-manager/server/ga4'

await sendServerEvent(
  { name: 'purchase', params: orderParams(order), clientId, consent },
  { destinations: [ga4Server({ measurementId, apiSecret }), metaCapi({ pixelId, accessToken })] },
)
```

Each destination follows its vendor's recommended setup (decided
2026-10-13):

- **Meta** dedupes browser and server events by `eventId`, so the handler
  forwards every browser event to CAPI.
- **GA4** has no such dedupe (only `purchase` by `transaction_id`), and Google
  says the Measurement Protocol augments the browser tag rather than
  replacing it. So `ga4Server` receives only server-only events through
  `sendServerEvent`; the handler never forwards browser events to it. The
  browser's GA client ID (and consent) must be saved with the order so the
  webhook event joins the user's session.

- Web-standard `(Request) => Promise<Response>`: works in the Next.js App
  Router, Remix, Hono, Cloudflare, Bun and Deno. An Express adapter is a
  few lines in the docs.
- When `server.endpoint` is set, the browser sends each event there with
  `keepalive` (with `sendBeacon` as a fallback), along with its consent and
  `eventId`.
- The handler:
  1. checks same-origin and the body size limit;
  2. validates the event;
  3. drops it unless the consent sent with it allows each destination;
  4. reads `_ga`, `_fbp` and `_fbc` from cookies, and the IP and user agent
     from headers;
  5. hashes personal data;
  6. sends to each destination in parallel.
- Server-only events (webhooks, e.g. a Stripe `purchase`) use
  `sendServerEvent(event, { destinations })` with the same event shapes.
- Server destinations follow a server plugin contract:
  `{ id, requiredConsent, forwardBrowserEvents, send(event, request?) }`.
  The handler only uses destinations with `forwardBrowserEvents: true`
  (`metaCapi`); passing `ga4Server` to it is a type error.

## Built-in providers

| Provider | Browser | Server | Notes |
|---|---|---|---|
| GA4 | ✓ | ✓ Measurement Protocol | consent mode |
| Meta Pixel | ✓ | ✓ CAPI | consent mode; sets consent before `init` |
| PostHog | ✓ | later | cookieless until analytics consent; replaces the adapters in Scriptie and Bruciami |
| Sentry | ✓ | ✓ Next instrumentation | errors without consent or personal data; Replay, tracing and the user after analytics consent |
| Hotjar | ✓ | — | gains `teardown` |
| Shopify | ✓ | — | analytics + Customer Privacy sync |
| TikTok | ✓ (loads the pixel) | later | today it only forwards consent to an SDK the app loads |
| Vercel Analytics | ✓ | — | cookieless: `requiredConsent: 'none'` |

## Stages

1. **Events and identity** (done)
   - `createAnalytics` instance. Provider factories keep their
     `createXAdapter` names until stage 2 ports them to `definePlugin`.
   - Standard events and packs; per-provider translation.
   - `identify` / `reset`.
   - Instance-based React provider.
2. **Contract and server** (done)
   - `definePlugin`, the manager-enforced lifecycle, the public helpers and the
     contract test kit; built-ins ported to them.
   - `createAnalyticsHandler`, the server destinations and automatic browser →
     server forwarding.
3. **PostHog, Sentry and errors** (done)
   - `posthog()` and `sentry()`, with SDKs as optional peer dependencies loaded
     per feature; every feature can be turned off and loading can be deferred.
   - `captureError`, the plugin `error` hook, `ErrorBoundary`, `createGlobalError`
     and the Sentry Next helpers (`/sentry/server`, `/sentry/next`).
   - Google Ads, Clarity, a TikTok loader and `docs/writing-a-plugin.md` are dropped.

Each stage ships as its own release candidate with a migration-guide section.

## Migration (summary)

| Today | v1 |
|---|---|
| `createAnalyticsManager` + `registerProvider` / module singletons | `createAnalytics({ providers })` |
| `createGa4Adapter`, `createMetaAdapter`, … | `ga4()`, `meta()`, … |
| `trackEvent('ViewContent', …)`, `trackViewContent()` | `track('view_item', productParams(product))` with `/ecommerce` |
| `saveIdentity({ email })` | `identify(userId?, { email })` |
| `sendMetaCapiEvent`, `sendGa4MeasurementEvent` + a hand-written route | `createAnalyticsHandler({ destinations })` |
| Custom `ProviderAdapter` (PostHog in Scriptie / Bruciami) | `definePlugin()` or the built-in `posthog()` |

## Out of scope

- Custom consent categories.
- Consent logging / proof-of-consent storage.
- A tag manager (GTM) replacement.
- Server-side PostHog and TikTok (later).
