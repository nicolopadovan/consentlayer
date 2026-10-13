---
title: Providers
description: Configure each provider, load SDKs later, proxy them past ad blockers and report errors.
---

A provider is a plugin that connects one vendor to consentlayer. Pass browser
providers to `createAnalytics({ providers })`. Pass consent sources, such as
Shopify Customer Privacy, to `createAnalytics({ consent: { adapters } })`.

## Available providers

| Provider | Needs consent | Required options | Behaviour |
|---|---|---|---|
| GA4 | analytics | `measurementId` | Starts Google Consent Mode with everything denied and updates it when consent changes. |
| Meta Pixel | marketing | `pixelId` | The browser pixel. Add the Conversions API on the server with `metaCapi` (see [Server-side tracking](/guides/server-side-tracking/)). |
| PostHog | none (cookieless) | `apiKey` | Counts without cookies until analytics is granted, then uses cookies. Turn on cookieless mode in the PostHog project. With `cookieless: false` it loads only after consent. |
| Sentry | none | `dsn` | Errors without personal data, whatever the consent. Replay, tracing and the user ID need analytics consent. |
| Contentsquare | analytics | `tagId` | Sends single-page-app page views, events, purchases and the user ID. Opts the visitor out when consent is withdrawn. |
| Vercel Analytics | none (cookieless) | `trackEvent` from `@vercel/analytics` | Receives events whatever the consent. |
| TikTok | marketing | none | Syncs consent to a `ttq` pixel you load yourself; it doesn't load the SDK. |
| Hotjar (deprecated) | analytics | `siteId`, `version` | Hotjar accounts are moving to Contentsquare; switch once yours has. Withdrawing consent deletes its cookies, but its script keeps running until the page reloads. Set `reloadOnRevoke: true` to reload. |
| Shopify Customer Privacy | consent source | none | `createShopifyCustomerPrivacyAdapter()` reads the visitor's choice from Shopify and keeps both in sync. |

Each factory has the provider's short name (`ga4()`, `meta()`, `posthog()`, `sentry()`,
`contentsquare()`, `vercel()`, `tiktok()`, `hotjar()`) and is imported from
`consentlayer/providers/<name>`, for example `consentlayer/providers/ga4`.
Shopify's is `createShopifyCustomerPrivacyAdapter()`, from `consentlayer/providers/shopify`. A provider can also require one
of your [custom categories](/guides/consent-ui/#custom-categories).

## PostHog and Sentry

Install the SDKs you use; they are optional peer dependencies:

```bash
pnpm add posthog-js                        # posthog()
pnpm add @sentry/browser @sentry/nextjs    # sentry(); @sentry/nextjs only for the Next.js helpers
```

Heavy features are off by default and load only when you turn them on:

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
  defer: 'idle',       // see "Loading SDKs later"
})

sentry({
  dsn,
  environment,
  release,
  replay: false,       // true or { sessionSampleRate, onErrorSampleRate }
  tracing: false,      // true or { sampleRate }
  tunnel,              // see "Reverse proxies"
  defer: 'interaction',
})
```

PostHog never captures page views, page leaves, exceptions, heatmaps or dead
clicks by itself, and its flags, surveys and remote scripts are off: page
views and errors come from consentlayer. `identify` and `group` wait for
analytics consent.

Sentry sends errors without IP addresses, cookies, headers, bodies or query
strings. Analytics consent adds the user ID (and the email, with marketing
consent), Replay and tracing. Withdrawing it stops Replay and drops
transactions. consentlayer installs the window error handlers, so Sentry's
own are removed.

## Loading SDKs later

Every provider accepts `defer`: `'idle'`, `'interaction'` (the first pointer,
key, scroll or touch event) or a number of milliseconds. Calls made in the
meantime are held, up to 100, and delivered once the SDK has loaded.

## Loading before consent

GA4 and Meta load nothing until their category is granted. You can load them
at boot with consent denied instead (Google Consent Mode, or
`fbq('consent', 'revoke')`). That keeps Google's cookieless pings and
modelling, but sends the visitor's IP address to Google or Meta before
consent:

```ts
ga4({ measurementId, loadBeforeConsent: true })
meta({ pixelId, loadBeforeConsent: true })
```

## Reverse proxies

Ad blockers drop requests to `posthog.com` and `sentry.io`. Serving them from
your own domain gets them through. For GA4 and Meta, use
[server-side tracking](/guides/server-side-tracking/) instead.

### PostHog

Add the rewrites from [PostHog's guide](https://posthog.com/docs/advanced/proxy/nextjs),
then point `apiHost` at them. Use `eu` instead of `us` for an EU project.

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

### Sentry

On a Next.js server, `withSentryConfig(config, { tunnelRoute: '/monitoring' })`
adds the route ([Sentry's guide](https://docs.sentry.io/platforms/javascript/troubleshooting/)).
It sets the tunnel only for `@sentry/nextjs`'s own client, so pass it to
`sentry()` yourself, with the organisation and project IDs from your DSN
(`https://<key>@o<orgId>.ingest.sentry.io/<projectId>`). If the DSN host is
`o<orgId>.ingest.<region>.sentry.io`, add `&r=<region>`.

```ts
sentry({ dsn, tunnel: '/monitoring?o=<orgId>&p=<projectId>' })
```

The tunnel works only with sentry.io (not self-hosted Sentry) and not with a
static export. Keep middleware off the route.

## Errors

`analytics.captureError(error, { level, tags, extra })` sends the error to
every provider that handles errors (Sentry and PostHog). consentlayer also
reports the window's `error` and `unhandledrejection` events. Turn those off
with `createAnalytics({ errors: { globalHandlers: false } })`, or turn off all
error reporting with `errors: false`. In React, add `ErrorBoundary` and
`createGlobalError` (see the [Next.js guide](/start/nextjs/#5-report-errors)).

## Writing your own

A provider is an object made with `definePlugin`. See
[Writing a plugin](/internals/plugins/).
