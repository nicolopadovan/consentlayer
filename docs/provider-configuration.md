# Provider Configuration

## Providers

| Provider | Factory | Consent gate | Required config | Notes |
| --- | --- | --- | --- | --- |
| GA4 | `ga4` | `analytics` | `measurementId` | Initializes Google Consent Mode with denied defaults, then updates on consent changes |
| Meta Pixel | `meta` | `marketing` | `pixelId` | Browser pixel; add CAPI with `metaCapi` on the server ([server-side tracking](./server-side-tracking.md)) |
| Shopify Customer Privacy | `createShopifyCustomerPrivacyAdapter` | consent source | optional headless storefront config | Bootstraps and syncs consent state |
| Hotjar | `hotjar` | `analytics` | `siteId`, `version`, `reloadOnRevoke` | Loads only after analytics consent; on withdrawal its cookies and storage are deleted, but its script keeps running and recreates them until the page reloads; set `reloadOnRevoke` to reload and stop it |
| TikTok consent bridge | `tiktok` | `marketing` | `ttq` loaded by consumer | Consent sync only; no SDK bootstrap in package |
| PostHog | `posthog` (`/providers/posthog`) | none (cookieless) | `apiKey` | Counts without cookies until analytics is granted, then uses cookies; needs cookieless mode on in the PostHog project. `cookieless: false` loads only after consent |
| Sentry | `sentry` (`/providers/sentry`) | none | `dsn` | Errors without personal data whatever the consent; Replay, tracing and the user ID after analytics consent |
| Vercel Analytics | `vercel` | none (cookieless) | `trackEvent` from `@vercel/analytics` | Receives events whatever the consent |

Pass browser providers to `createAnalytics({ providers: [...] })` and consent
sources such as Shopify Customer Privacy to
`createAnalytics({ consent: { adapters: [...] } })`.

## PostHog And Sentry

Install the SDKs you use; they are optional peer dependencies:

```bash
pnpm add posthog-js                        # posthog()
pnpm add @sentry/browser @sentry/nextjs    # sentry(); @sentry/nextjs only for the Next helpers
```

Everything heavy is off by default and loads only when turned on:

```ts
posthog({
  apiKey,
  apiHost,             // default https://us.i.posthog.com
  cookieless: true,    // false: load nothing until analytics consent
  autocapture: false,
  recording: false,    // session recording, after analytics consent
  errors: true,        // receive captureError
  groupType: 'company',
  defer: 'idle',       // see "Deferred Loading"
})

sentry({
  dsn,
  environment,
  release,
  replay: false,       // true or { sessionSampleRate, onErrorSampleRate }
  tracing: false,      // true or { sampleRate }
  defer: 'interaction',
})
```

PostHog never captures page views, page leaves, exceptions, heatmaps or dead
clicks by itself, and flags, surveys and remote scripts are off: page views and
errors come from the manager. Identify and group wait for analytics consent.

Sentry sends errors without IP, cookies, headers, bodies or query strings.
Analytics consent adds the user ID (and email, with marketing consent), Replay
and tracing; withdrawing it stops Replay and drops transactions. The manager
installs the window error handlers, so Sentry's own are removed.

## Errors

`analytics.captureError(error, { level, tags, extra })` sends to every plugin
with an `error` hook (Sentry, PostHog). The manager also reports window
`error` and `unhandledrejection` events. Turn them off with
`createAnalytics({ errors: { globalHandlers: false } })`, or all error
reporting with `errors: false`. React apps add `ErrorBoundary` and
`createGlobalError` (see [Next.js integration](./nextjs-integration.md)).

## Deferred Loading

Any plugin takes `defer`: `'idle'`, `'interaction'` (first pointer, key,
scroll or touch) or a number of milliseconds. Calls made meanwhile are held, up to 100,
and delivered after the SDK loads.

## Environment Variables Used By The Example App

- `NEXT_PUBLIC_ENABLE_ANALYTICS`
- `NEXT_PUBLIC_ANALYTICS_DEBUG`
- `NEXT_PUBLIC_ANALYTICS_LOCALE` (consent UI language)
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `NEXT_PUBLIC_HOTJAR_SITE_ID`
- `NEXT_PUBLIC_HOTJAR_VERSION`
- `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`
- `NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT`
- `NEXT_PUBLIC_SHOPIFY_STORE_ID`
- `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`
- `NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN` (server)
- `META_TOKEN`
- `FACEBOOK_TEST_EVENT_CODE`

## Consent Notes

- analytics providers should never initialize without analytics consent
- Meta should never dispatch without marketing consent
- consent updates are broadcast to adapters and to the configured DOM/global channel

## Storage And Broadcast Defaults

The package default runtime preset uses:

- `consentlayer_consent`
- `consentlayer_user_identity`
- `consentlayer:consent`
- `CONSENTLAYER_CONSENT`
- `CONSENTLAYER_openConsent`

Change them with `configureNames()`; see "Names" in the README. The pre-rc.2
`acm_*` names are read, migrated and broadcast too with `legacy: true`.

## Loading Before Consent

GA4 and Meta load nothing until their category is granted. To load them at
boot with consent denied (Consent Mode / `fbq('consent', 'revoke')`), which
keeps Google's cookieless pings and modelling but sends the visitor's IP to
Google or Meta before consent:

```ts
ga4({ measurementId, loadBeforeConsent: true })
meta({ pixelId, loadBeforeConsent: true })
```
