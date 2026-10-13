---
title: Providers
description: The built-in providers, their consent requirements and options, deferred loading, reverse proxies and error reporting.
---

This page covers the providers that ship with ConsentLayer: the consent
category each one requires, its options and its exact behaviour, followed by
deferred SDK loading, loading before consent, reverse proxies and error
reporting.

A provider is a plugin that connects one vendor to the instance. Browser
providers are passed to `createAnalytics({ providers })`. Consent sources,
such as Shopify Customer Privacy, are adapters and are passed to
`createAnalytics({ consent: { adapters } })` instead.

## Available providers

Each provider is a named export of its own entry point,
`consentlayer/providers/<name>`, so importing one never bundles another.

| Provider | Factory | Required consent | Required options |
|---|---|---|---|
| GA4 | `ga4()` from `consentlayer/providers/ga4` | `analytics` | `measurementId` |
| Meta Pixel | `meta()` from `consentlayer/providers/meta` | `marketing` | `pixelId` |
| PostHog | `posthog()` from `consentlayer/providers/posthog` | `'none'`; `analytics` with `cookieless: false` | `apiKey` |
| Sentry | `sentry()` from `consentlayer/providers/sentry` | `'none'` | `dsn` |
| Contentsquare | `contentsquare()` from `consentlayer/providers/contentsquare` | `analytics` | `tagId` |
| Vercel Analytics | `vercel()` from `consentlayer/providers/vercel` | `'none'` | `trackEvent` |
| TikTok | `tiktok()` from `consentlayer/providers/tiktok` | `marketing` | None |
| Hotjar (deprecated) | `hotjar()` from `consentlayer/providers/hotjar` | `analytics` | `siteId`, `version` |
| Shopify Customer Privacy | `createShopifyCustomerPrivacyAdapter()` from `consentlayer/providers/shopify` | Consent source | None |

The ID options of GA4, Meta, PostHog, Sentry, Contentsquare and Hotjar may be
`undefined` or empty: the provider is then turned off, and with `debug: true`
it logs `[consentlayer] <id> is off: <option> is not set.` at boot. Pass
`process.env` values directly instead of guarding each provider. String IDs
are trimmed first, so a trailing newline in an environment variable is
harmless and a whitespace-only value counts as unset. A value that is set but
malformed still throws.

A provider whose required consent is `'none'` loads at boot and receives
calls regardless of the visitor's choice. Every other provider loads only once
its category is granted (or at boot with `loadBeforeConsent`), receives `page`, `track`, `identify` and `group`
calls only while it stays granted, and is torn down when it is withdrawn.
The exact order of these hooks is described in
[Lifecycle](/internals/lifecycle/).

`ga4()` and `meta()` validate their IDs when called and throw on a malformed
value: `measurementId` must match `G-` followed by 4 to 16 uppercase letters
or digits, and `pixelId` must be a string of 8 to 20 digits.

Event names follow GA4 and each provider translates them to its own; see
[Events and identity](/guides/events/). A
[custom plugin](/internals/plugins/) can also require one of your
[custom categories](/guides/consent-ui/#custom-categories).

## Provider reference

<details>
<summary>GA4</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `measurementId` | `string \| undefined` | Required | The `G-` measurement ID. |
| `loadBeforeConsent` | `boolean` | `false` | Loads gtag.js at boot with Consent Mode denied. See [Loading before consent](#loading-before-consent). |
| `consentMode` | `Ga4ConsentMode` | `{ mode: 'basic' }` | Advanced mode, region defaults and other Consent Mode settings. See [Google Consent Mode](#google-consent-mode). |

At setup, before any network request, `ga4()` creates `window.dataLayer` and
`window.gtag` and sets the Consent Mode v2 defaults: `ad_storage`,
`ad_user_data`, `ad_personalization`, `analytics_storage` and
`functionality_storage` denied, `security_storage` granted. Once the visitor
has a choice, each consent change sends `gtag('consent', 'update')` with this
mapping:

| Consent Mode signal | Granted when |
|---|---|
| `analytics_storage` | `analytics` is granted |
| `ad_storage`, `ad_user_data`, `ad_personalization` | `marketing` is granted |
| `functionality_storage` | `preferences` is granted |
| `security_storage` | Always |

`gtag('config', measurementId, { send_page_view: false })` runs once, after
analytics consent is first granted, so GA4 never sends a hit before it. Page
views are sent as `page_view` events with `page_location`, `page_path` and
`page_title`. `identify` sets `user_id` and `user_data` (the email, and the
phone number prefixed with `+`); `reset` clears both. A failed script load is
reported to `onError` with scope `provider-script-load`.

</details>

<details>
<summary>Meta Pixel</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | Required | The 8 to 20 digit pixel ID. |
| `locale` | `string` | `'en_US'` | The locale segment of the `fbevents.js` URL. |
| `loadBeforeConsent` | `boolean` | `false` | Loads the pixel at boot with `fbq('consent', 'revoke')`. See [Loading before consent](#loading-before-consent). |

On load, `meta()` runs Meta's bootstrap snippet, calls `fbq('consent', …)`
with the current marketing consent and `fbq('init', pixelId, userData)` with
advanced-matching data (`em`, `ph` as digits only, and `external_id`), then
loads `https://connect.facebook.net/<locale>/fbevents.js`. Every consent
change calls `fbq('consent', 'grant')` or `fbq('consent', 'revoke')`.

Page views are sent as `PageView`; events are sent with `fbq('track')` for
Meta standard events and `fbq('trackCustom')` otherwise. Both carry
`eventID`, the same ID that is forwarded to the Conversions API, so Meta
deduplicates the pair (see [Server-side tracking](/guides/server-side-tracking/)).

Meta accepts advanced-matching data only in `fbq('init')`. If the pixel was
initialised with an email address or phone number and marketing consent is
then withdrawn, the pixel stays revoked and sends nothing for the rest of the
page's lifetime, even if consent is granted again. It resumes after a reload.

For visitors without JavaScript, `<MetaPixelNoscript pixelId enabled />` from
`consentlayer/react` renders Meta's `<noscript>` image pixel. It fires without
consent, since those visitors never see a banner. It renders nothing without
`enabled` or while `pixelId` is `undefined` or empty.

</details>

<details>
<summary>Contentsquare</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `tagId` | `string \| undefined` | Required | The ID in the tag URL, `https://t.contentsquare.net/uxa/<tagId>.js`. |

The tag tracks the initial page view itself, so the first `page()` call for the
path the tag loaded on is skipped. Later page views are sent as
`trackPageview` with the path, without its query string and fragment.
`purchase` is sent as an ecommerce transaction (`transaction_id`, `value` and
`currency` become `id`, `revenue` and `currency`); every other event is sent
as `trackPageEvent` with its name only, without params. `identify` sends the
user ID and `reset` calls `resetIdentity`.

Contentsquare has no web opt-in. Withdrawing analytics consent pushes
Contentsquare's `optout` command. Granting consent again expires the
`_cs_optout` cookie, which takes effect on the next page load.

</details>

<details>
<summary>Vercel Analytics</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `trackEvent` | `(name: string, payload: Record<string, string \| number \| boolean \| null>) => void` | Required | `track` from `@vercel/analytics`. |

Vercel Analytics sets no cookies, so `vercel()` requires no consent and
receives every `track` call. It does not handle page views. Params are
reduced to the types Vercel accepts: `null` and `undefined` become `null`,
strings, numbers and booleans are kept, `Date` values become ISO strings, and
all other values are dropped. To gate it on consent anyway, spread it:
`{ ...vercel(options), requiredConsent: 'analytics' }`.

</details>

<details>
<summary>TikTok</summary>

`tiktok()` takes no options and does not load TikTok's SDK. Load the `ttq`
pixel yourself; on every consent change, if `window.ttq` is a function,
`tiktok()` calls `ttq('consent', 'grant')` when marketing is granted and
`ttq('consent', 'reject')` otherwise. It forwards no events.

</details>

<details>
<summary>Hotjar (deprecated)</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `siteId` | `number \| string \| undefined` | Required | The Hotjar site ID, as a number or a string of digits. |
| `version` | `number \| string \| undefined` | Required | The snippet version, `hjsv`, as a number or a string of digits. |
| `reloadOnRevoke` | `boolean` | `false` | Reloads the page when analytics consent is withdrawn. |

An unset, empty or whitespace-only `siteId` or `version` turns the provider
off. Surrounding whitespace is trimmed. Any other value that is not a positive
integer written in digits, such as `'1e3'` or `'12.0'`, throws `[consentlayer] Invalid Hotjar siteId or
version: expected positive integers, …`.

Hotjar accounts are moving to Contentsquare; switch to `contentsquare()` once
yours has. Events are sent as `hj('event', name)`. `identify` calls
`hj('identify', userId, traits)`, adding the email to the attributes when both
a user ID and an email are known.

Hotjar's script cannot be stopped once loaded. Withdrawing analytics consent
expires every cookie whose name starts with `_hj` and removes every
`localStorage` and `sessionStorage` key matching `^_?hj`, but the script keeps
running until the page reloads. Set `reloadOnRevoke: true` to reload
immediately.

</details>

## PostHog and Sentry

Both providers are built on the vendor's npm SDK, which is an optional peer
dependency. Install the ones you use:

```bash
pnpm add posthog-js         # posthog()
pnpm add @sentry/browser    # sentry()
pnpm add @sentry/nextjs     # consentlayer/sentry/server and consentlayer/sentry/next only
```

The SDK is imported with a dynamic `import()` when the provider loads, and
features that pull in more code, such as session recording, Session Replay and
tracing, are off by default and imported only once enabled and consented to.

PostHog never captures page views, page leaves, exceptions, heatmaps or dead
clicks on its own, and its feature flags, surveys and remote script loading
are disabled: page views, events and errors come from ConsentLayer. It starts
opted out of capturing and persistence. With the default `cookieless: true`,
PostHog counts visitors in its cookieless mode until analytics consent is
granted, then opts in and uses cookies; this requires cookieless mode to be
enabled in the PostHog project settings. `identify` and `group` are sent only
with analytics consent.

Sentry reports errors regardless of consent and without personal data: user
info, cookies, HTTP headers, request bodies and URL query strings are not
collected. Analytics consent adds the user ID (and the email address, which
ConsentLayer shares only with marketing consent), Session Replay and tracing.
Withdrawing analytics consent stops Replay and drops transactions.
ConsentLayer installs the window error handlers itself, so Sentry's
`GlobalHandlers` integration is removed.

<details>
<summary>PostHog options</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string \| undefined` | Required | The project API key. |
| `apiHost` | `string` | `'https://us.i.posthog.com'` | The ingestion host, or a reverse-proxy path. |
| `uiHost` | `string` | None | PostHog's app URL, such as `https://us.posthog.com`, for toolbar links when `apiHost` is a proxy. |
| `cookieless` | `boolean` | `true` | `true` loads PostHog at boot in cookieless mode (`cookieless_mode: 'on_reject'`). `false` makes the provider require analytics consent and load nothing before it. |
| `autocapture` | `boolean` | `false` | PostHog autocapture. |
| `recording` | `boolean` | `false` | Session recording, started after analytics consent. Imports `posthog-js/dist/recorder` on first use. |
| `errors` | `boolean` | `true` | Sends `captureError` errors to PostHog error tracking with `captureException`. |
| `groupType` | `string` | `'company'` | The group type `analytics.group()` uses. |
| `defer` | `false \| 'idle' \| 'interaction' \| number` | `false` | See [Loading SDKs later](#loading-sdks-later). |

Page views are captured as `$pageview` with `$current_url` and `title`.
`track` captures the event name with its params merged with
`options.providers.posthog`. `identify` sends the user ID, with the email as a
person property when it is known. `reset` calls PostHog's `reset()` and
re-applies the current consent.

</details>

<details>
<summary>Sentry options</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `dsn` | `string \| undefined` | Required | The project DSN. |
| `environment` | `string` | None | Passed to `Sentry.init`. |
| `release` | `string` | None | Passed to `Sentry.init`. |
| `replay` | `boolean \| { sessionSampleRate?: number; onErrorSampleRate?: number }` | `false` | Session Replay after analytics consent. `true` uses a session sample rate of `0.1` and an on-error sample rate of `1`. |
| `tracing` | `boolean \| { sampleRate?: number }` | `false` | Performance tracing after analytics consent. `true` uses a sample rate of `1`. |
| `tunnel` | `string` | None | Sends envelopes to this URL instead of the DSN host. See [Sentry](#sentry). |
| `defer` | `false \| 'idle' \| 'interaction' \| number` | `false` | See [Loading SDKs later](#loading-sdks-later). |

The Replay integration is imported and added when analytics consent is first
granted, and stopped when it is withdrawn. Granting consent again restarts it
in buffering mode, which records only around errors; session sampling resumes
on the next page load. The tracing integration is added once, on the first
grant. `captureError` calls reach Sentry with their `level`, `extra` and
`tags`, plus a `source` tag of `manual`, `global` or `boundary`.

For Next.js server and edge code, `sentryInstrumentation` from
`consentlayer/sentry/server` configures `@sentry/nextjs` with the same data
collection settings; see [Server errors](/start/nextjs/#server-errors).

</details>

## Shopify Customer Privacy

`createShopifyCustomerPrivacyAdapter()` keeps the instance and Shopify's
Customer Privacy API in agreement. When no choice is stored locally, it reads
the visitor's existing choice from `Shopify.customerPrivacy.currentVisitorConsent()`
at bootstrap. Every choice made through ConsentLayer is written to Shopify with
`setTrackingConsent()`, and Shopify's `visitorConsentCollected` DOM event is
applied back to the instance. The optional `sale_of_data` flag is passed
through in both directions.

```ts
import { createShopifyCustomerPrivacyAdapter } from 'consentlayer/providers/shopify'

createAnalytics({
  providers,
  consent: {
    adapters: [
      createShopifyCustomerPrivacyAdapter({
        headlessStorefront: { storefrontAccessToken: process.env.NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN },
      }),
    ],
  },
})
```

On a Shopify-hosted theme the token is unset and `headlessStorefront` is
ignored; on a headless storefront it is set and the headless options apply.

<details>
<summary>Shopify adapter options</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `loadFeature` | `boolean` | `true` | Before reading or writing consent, loads Shopify's Customer Privacy script on a headless storefront (when `storefrontAccessToken` is set and `Shopify.customerPrivacy` is missing), then calls `Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }])` when available. `false` skips both. |
| `headlessStorefront` | `{ checkoutRootDomain?, storefrontRootDomain?, storefrontAccessToken? }` | None | Required off Shopify-hosted themes. Applies only once `storefrontAccessToken` is set, so you can pass the environment variable directly; then passed to `setTrackingConsent` with `headlessStorefront: true`. |
| `canBootstrap` | `() => boolean` | None | Returning `false` skips reading Shopify's existing choice at bootstrap. |
| `document` | `Document` | The global `document` | The document to listen on. |
| `window` | `Window` | The global `window` | The window that holds `Shopify`. |

Shopify reports consent as strings. `granted`, `allow`, `accepted`, `yes` and
`true` (case-insensitive) map to `true`; any other value maps to `false`. If
Shopify reports no value for any category, the visitor is treated as not
having chosen yet.

On a headless storefront the adapter loads Shopify's script from
`cdn.shopify.com` itself. Its URL is also returned by
`getShopifyCustomerPrivacyScriptUrl()`, exported from the same entry point,
for a Content Security Policy or a preload hint.

</details>

## Loading SDKs later

`posthog()` and `sentry()` accept `defer`, which postpones loading the SDK
until after its consent requirement is met. A [custom plugin](/internals/plugins/)
can set the same `defer` field.

| Value | Loads |
|---|---|
| `false` (default) | Immediately. |
| `'idle'` | In a `requestIdleCallback` with a 5,000 ms timeout, or after `setTimeout(…, 1)` where it is unavailable. |
| `'interaction'` | On the first `pointerdown`, `keydown`, `scroll` or `touchstart` event on `window`. |
| `number` | After that many milliseconds. |

Calls made to the provider in the meantime are held in order and delivered
once it has loaded. At most 100 calls are held per provider; later ones are
dropped and a single `queue-full` error is reported to `onError`. If consent
is withdrawn before the provider loads, it is not loaded and its held calls
are discarded.

## Loading before consent

By default, GA4 and Meta Pixel load nothing until their category is granted.
With `loadBeforeConsent: true`, the vendor script is loaded at boot with
consent denied: gtag.js with the Consent Mode defaults above, and the pixel
with `fbq('consent', 'revoke')`.

```ts
ga4({ measurementId, loadBeforeConsent: true })
meta({ pixelId, loadBeforeConsent: true })
```

No hits are sent before consent either way: GA4 is configured only after
analytics consent is granted, and the pixel sends events only with marketing
consent. The effect is that the script is already loaded when the visitor
consents. The script request itself discloses the visitor's IP address to
Google or Meta before consent.

## Google Consent Mode

`ga4()` uses Consent Mode v2 in what Google calls basic mode by default: the
tag is configured only after `analytics` is granted, so Google receives
nothing before consent. `consentMode` changes that and adds Google's other
Consent Mode settings:

```ts
ga4({
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  consentMode: {
    mode: 'advanced',
    regions: [{ region: ['US'], analytics: true, marketing: true }],
    waitForUpdate: 500,
    urlPassthrough: true,
    adsDataRedaction: true,
  },
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'basic' \| 'advanced'` | `'basic'` | `'advanced'` loads gtag.js and configures the tag at boot. |
| `regions` | `Ga4RegionDefault[]` | `[]` | Advanced mode only. Categories that count as granted before a choice in the listed regions. |
| `waitForUpdate` | `number` | None | Milliseconds gtag waits for a consent update before sending, as `wait_for_update` in each default. A whole number, `0` or more. |
| `urlPassthrough` | `boolean` | `false` | `gtag('set', 'url_passthrough', true)`: passes ad click IDs through links while `ad_storage` is denied. |
| `adsDataRedaction` | `boolean` | `false` | `gtag('set', 'ads_data_redaction', true)`: redacts ad click data while `ad_storage` is denied. |

### Advanced mode

In advanced mode the tag is configured at boot, before the visitor chooses.
While consent is denied, Google receives cookieless pings for page views and
events, without cookies, and uses them to model the visitors who decline.
`page()` and `track()` reach GA4 whatever the visitor chose; the Consent Mode
signals decide what Google does with them. `user_id` and `user_data` are set
only while `analytics` is granted.

Advanced mode sends data to Google before consent. Whether that is allowed
depends on the regions you serve and your legal basis.

### Region defaults

Each entry in `regions` lists ISO 3166-2 codes, a country such as `'US'` or a
subdivision such as `'US-CA'`, and the categories granted there before a
choice. Every category it leaves out is denied, and visitors outside every
listed region keep the denied defaults. Google picks the entry by the
visitor's location, and the most specific region wins:

```ts
regions: [
  { region: ['US'], analytics: true, marketing: true },
  { region: ['US-CA'], analytics: true },
]
```

Here a visitor in California starts with analytics granted and marketing
denied, the rest of the United States with both granted, and everyone else
with everything denied. A region default affects GA4 only: ConsentLayer's
consent stays `null` until the visitor chooses, so the banner is shown and
other providers wait. Once the visitor chooses, their choice replaces the
default.

Setting `regions` without `mode: 'advanced'` is a type error and throws, since
in basic mode the tag is configured only after consent and Google never acts
on a default. A code that is not two uppercase letters, optionally followed by
`-` and up to three letters or digits, also throws.

## Reverse proxies

Ad blockers drop requests to `posthog.com` and `sentry.io`. Serving them
through your own domain avoids this. For GA4 and Meta, use
[server-side tracking](/guides/server-side-tracking/) instead.

### PostHog

Add the rewrites from [PostHog's guide](https://posthog.com/docs/advanced/proxy/nextjs),
then set `apiHost` to the proxy path and `uiHost` to PostHog's app URL. For an
EU project, replace `us` with `eu` in every host.

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

In Next.js, `withSentryConfig(config, { tunnelRoute: '/monitoring' })` from
`consentlayer/sentry/next` adds a rewrite from
`/monitoring?o=<orgId>&p=<projectId>` to
`https://o<orgId>.ingest.sentry.io/api/<projectId>/envelope/`
([Sentry's guide](https://docs.sentry.io/platforms/javascript/troubleshooting/)).
It configures the tunnel only for `@sentry/nextjs`'s own client, so pass it to
`sentry()` as well, with the organisation and project IDs from your DSN,
`https://<key>@o<orgId>.ingest.sentry.io/<projectId>`. If the DSN host is
`o<orgId>.ingest.<region>.sentry.io`, append `&r=<region>`.

```ts
sentry({ dsn, tunnel: '/monitoring?o=<orgId>&p=<projectId>' })
```

The rewrite targets sentry.io only, so it does not work with self-hosted
Sentry, and Next.js rewrites are unavailable in a static export. Exclude the
route from your middleware matcher.

## Errors

`analytics.captureError(error, { level, tags, extra })` sends an error to
every active provider that handles errors: Sentry, and PostHog unless
`errors: false`. `level` is `'fatal'`, `'error'` or `'warning'`.

ConsentLayer also reports the window's `error` events, with level `fatal`,
and `unhandledrejection` events. Like every other call, errors captured before
`boot()` are queued, up to 100 calls, and delivered once it completes.

| `createAnalytics` option | Effect |
|---|---|
| `errors: true` (default) | `captureError` and the window handlers. |
| `errors: { globalHandlers: false }` | `captureError` only. |
| `errors: false` | No error reporting; `captureError` does nothing. |

In React, wrap the tree in `ErrorBoundary` from `consentlayer/react`; see
[Report errors](/start/react/#4-report-errors). In Next.js, also export
`createGlobalError(analytics)` from `app/global-error.tsx`; see [Global
errors](/start/nextjs/#global-errors).

## Writing your own

A provider is an object typed with `definePlugin` from `consentlayer`. See
[Writing a plugin](/internals/plugins/) and
[What each provider receives](/internals/providers/).
