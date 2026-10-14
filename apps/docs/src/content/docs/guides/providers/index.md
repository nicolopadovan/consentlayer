---
title: Providers
description: The built-in providers, their consent requirements and options, deferred loading, reverse proxies and error reporting.
---

This page covers what the providers that ship with ConsentLayer have in
common: the consent category each one requires, deferred SDK loading, loading
before consent, reverse proxies and error reporting. Each provider's options
and exact behaviour are on its own page.

A provider is a plugin that connects one vendor to the instance. Browser
providers are passed to `createAnalytics({ providers })`. Consent sources,
such as Shopify Customer Privacy and IAB TCF, are adapters and are passed to
`createAnalytics({ consent: { adapters } })` instead.

## Available providers

Each provider is a named export of its own entry point,
`consentlayer/providers/<name>`, so importing one never bundles another.

| Provider | Factory | Required consent | Required options |
|---|---|---|---|
| [GA4](/guides/providers/ga4/) | `ga4()` from `consentlayer/providers/ga4` | `analytics` | `measurementId` |
| [Meta Pixel](/guides/providers/meta/) | `meta()` from `consentlayer/providers/meta` | `marketing` | `pixelId` |
| [PostHog](/guides/providers/posthog/) | `posthog()` from `consentlayer/providers/posthog` | `'none'`; `analytics` with `cookieless: false` | `apiKey` |
| [Sentry](/guides/providers/sentry/) | `sentry()` from `consentlayer/providers/sentry` | `'none'` | `dsn` |
| [Contentsquare](/guides/providers/contentsquare/) | `contentsquare()` from `consentlayer/providers/contentsquare` | `analytics` | `tagId` |
| [Vercel Analytics](/guides/providers/vercel/) | `vercel()` from `consentlayer/providers/vercel` | `'none'` | `trackEvent` |
| [TikTok Pixel](/guides/providers/tiktok/) | `tiktok()` from `consentlayer/providers/tiktok` | `marketing` | `pixelId` |
| [Hotjar (deprecated)](/guides/providers/hotjar/) | `hotjar()` from `consentlayer/providers/hotjar` | `analytics` | `siteId`, `version` |
| [Shopify Customer Privacy](/guides/providers/shopify/) | `createShopifyCustomerPrivacyAdapter()` from `consentlayer/providers/shopify` | Consent source | None |
| [IAB TCF](/guides/providers/tcf/) | `createTcfAdapter()` from `consentlayer/providers/tcf` | Consent source, read-only | None |

The ID options of GA4, Meta, TikTok, PostHog, Sentry, Contentsquare and Hotjar may be
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

By default, GA4, Meta Pixel and TikTok Pixel load nothing until their
category is granted. With `loadBeforeConsent: true`, the vendor script is
loaded at boot with consent denied: gtag.js with the
[Consent Mode defaults](/guides/providers/ga4/#how-it-works), the Meta pixel with `fbq('consent', 'revoke')` and the TikTok pixel
with `ttq.holdConsent()`.

```ts
ga4({ measurementId, loadBeforeConsent: true })
meta({ pixelId, loadBeforeConsent: true })
tiktok({ pixelId, loadBeforeConsent: true })
```

No hits are sent before consent either way: GA4 is configured only after
analytics consent is granted, and the pixels send events only with marketing
consent. The effect is that the script is already loaded when the visitor
consents. The script request itself discloses the visitor's IP address to
Google, Meta or TikTok before consent.

## Reverse proxies

Ad blockers drop requests to `posthog.com` and `sentry.io`. Serving them
through your own domain avoids this; see [PostHog](/guides/providers/posthog/#reverse-proxy)
and [Sentry](/guides/providers/sentry/#reverse-proxy). For GA4 and Meta, use
[server-side tracking](/guides/server-side-tracking/) instead.

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
