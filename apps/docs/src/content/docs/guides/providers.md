---
title: Provider Configuration
description: Options for every provider, deferred loading and loading before consent.
---

## Providers

| Provider | Factory | Consent gate | Required config | Notes |
| --- | --- | --- | --- | --- |
| GA4 | `ga4` | `analytics` | `measurementId` | Initializes Google Consent Mode with denied defaults, then updates on consent changes |
| Meta Pixel | `meta` | `marketing` | `pixelId` | Browser pixel; add CAPI with `metaCapi` on the server ([server-side tracking](/guides/server-side-tracking/)) |
| Shopify Customer Privacy | `createShopifyCustomerPrivacyAdapter` | consent source | optional headless storefront config | Bootstraps and syncs consent state |
| Contentsquare | `contentsquare` (`/providers/contentsquare`) | `analytics` | `tagId` | Loads only after analytics consent; sends single-page-app page views, events, purchases and the user ID; on withdrawal it opts the visitor out |
| Hotjar (deprecated) | `hotjar` | `analytics` | `siteId`, `version`, `reloadOnRevoke` | Hotjar accounts are moving to Contentsquare: switch to `contentsquare` once yours has. Loads only after analytics consent; on withdrawal its cookies and storage are deleted, but its script keeps running and recreates them until the page reloads; set `reloadOnRevoke` to reload and stop it |
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
  uiHost,              // set with a proxy apiHost, e.g. https://us.posthog.com
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
  tunnel,              // see "Reverse Proxies"
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

## Reverse Proxies

Ad blockers drop requests to `posthog.com` and `sentry.io`. Serving them from
your own domain gets them through. GA4 and Meta are better covered by
[server-side tracking](/guides/server-side-tracking/).

**PostHog** ([docs](https://posthog.com/docs/advanced/proxy/nextjs)): add the
rewrites, then point `apiHost` at them. Use `eu` instead of `us` for an EU project.

```js
// next.config.js
export default {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/array/:path*', destination: 'https://us-assets.i.posthog.com/array/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
}
```

```ts
posthog({ apiKey, apiHost: '/ingest', uiHost: 'https://us.posthog.com' })
```

**Sentry** ([docs](https://docs.sentry.io/platforms/javascript/troubleshooting/)):
`withSentryConfig(config, { tunnelRoute: '/monitoring' })` adds the route on a
Next.js server. It only sets the tunnel for `@sentry/nextjs`'s own client, so
pass it to `sentry()` yourself, with the org and project IDs from your DSN
(`https://<key>@o<orgId>.ingest.sentry.io/<projectId>`, plus `&r=<region>` for
a `o<orgId>.ingest.<region>.sentry.io` host):

```ts
sentry({ dsn, tunnel: '/monitoring?o=<orgId>&p=<projectId>' })
```

The route works only with sentry.io (not self-hosted) and not with a static
export. Keep middleware off it.

## Errors

`analytics.captureError(error, { level, tags, extra })` sends to every plugin
with an `error` hook (Sentry, PostHog). The manager also reports window
`error` and `unhandledrejection` events. Turn them off with
`createAnalytics({ errors: { globalHandlers: false } })`, or all error
reporting with `errors: false`. React apps add `ErrorBoundary` and
`createGlobalError` (see [Next.js integration](/start/nextjs/)).

## Deferred Loading

Any plugin takes `defer`: `'idle'`, `'interaction'` (first pointer, key,
scroll or touch) or a number of milliseconds. Calls made meanwhile are held, up to 100,
and delivered after the SDK loads.

## Environment Variables Used By The Example App

- `NEXT_PUBLIC_ENABLE_ANALYTICS`
- `NEXT_PUBLIC_ANALYTICS_DEBUG`
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
