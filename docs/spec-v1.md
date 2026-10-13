# Spec: v1 architecture

Status: stage 1 implemented · 2026-10-13

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
- `docs/writing-a-plugin.md` is enough to build the PostHog plugin from scratch.
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

Deferred to stage 2: a package-level anonymous ID. Each provider keeps its
own until server forwarding needs a shared one.

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
  requiredConsent: 'analytics',
  consentMode?: true,           // can load before consent with tracking denied
  setup(ctx),                   // no network, no cookies
  load(ctx),                    // inject scripts; runs once
  consent(ctx),                 // apply the current consent state
  identify(identity, ctx),
  reset(ctx),
  page(payload, ctx),
  track(event, ctx),            // receives the standard event
  teardown(ctx),                // stop sending; remove cookies where possible
})
```

The manager, not the plugin, enforces the rules:

1. `setup` runs at boot.
2. `load` runs once the category is granted. If the plugin declares
   `consentMode` and the consumer passes `loadBeforeConsent: true`, `load`
   runs at boot instead, and `consent` always runs before the first call to
   the provider.
3. `page`, `track` and `identify` run only while consent is granted. Calls
   made before `load` are queued and replayed after it.
4. A withdrawal runs `teardown`; tracking calls are dropped until consent
   returns.
5. Every hook is wrapped: an error is reported through `onError` and never
   breaks other providers.

Public helpers for plugin authors: `loadScript(src, attrs)`, `getFlag` /
`setFlag`, `mapEvent(event, table)`, `hashUserData()`, and a contract test kit
(`/testing`) that every built-in also uses.

## Server

```ts
// app/api/analytics/route.ts
import { createAnalyticsHandler } from '@nicolopadovan/analytics-consent-manager/server'
import { ga4Server } from '@nicolopadovan/analytics-consent-manager/server/ga4'
import { metaCapi } from '@nicolopadovan/analytics-consent-manager/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [
    ga4Server({ measurementId, apiSecret: process.env.GA4_API_SECRET! }),
    metaCapi({ pixelId, accessToken: process.env.META_CAPI_TOKEN! }),
  ],
})
```

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
  `{ id, requiredConsent, send(event, request) }`.

## Built-in providers

| Provider | Browser | Server | Notes |
|---|---|---|---|
| GA4 | ✓ | ✓ Measurement Protocol | consent mode |
| Meta Pixel | ✓ | ✓ CAPI | consent mode; sets consent before `init` |
| Google Ads | ✓ (stage 3) | — | shares GA4's gtag loader |
| PostHog | ✓ (stage 3) | later | replaces the adapters in Scriptie and Bruciami |
| Microsoft Clarity | ✓ (stage 3) | — | uses Clarity's consent API |
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
2. **Contract and server**
   - `definePlugin`, the manager-enforced lifecycle, the public helpers and the
     contract test kit; built-ins ported to them.
   - `createAnalyticsHandler`, the server destinations and automatic browser →
     server forwarding.
3. **New providers**
   - PostHog, Google Ads, Clarity and a TikTok loader.
   - `docs/writing-a-plugin.md`.

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
