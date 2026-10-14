---
title: What each provider receives
description: Exactly what each built-in provider loads, sends and clears, and under which consent.
sidebar:
  order: 3
---

This page lists, for each built-in provider, which script or SDK it loads,
which vendor calls each hook makes, and what personal data reaches the vendor
under which consent. Options and setup are covered in
[Providers](/guides/providers/), and event name translation in
[Events](/guides/events/). The source of each provider is in
`src/providers/<name>.ts`.

## Rules that apply to every provider

The analytics manager drives every provider through the same contract (see
[Lifecycle](/internals/lifecycle/)):

| Hook                                          | When it runs                                                                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup`                                       | Once, whatever the consent: when the instance is created in the browser, or on the first lifecycle pass after `boot()` if `enabled` was false then or the provider was registered later.                                              |
| `consent`                                     | On every lifecycle pass (boot, each consent change, each registration after boot), for every provider, before `load`. Providers that are not allowed to run still receive it, which is how vendor consent modes learn about a denial. |
| `load`                                        | Once, on the first pass where the provider's requirement is met, or at boot with `loadBeforeConsent`. With `defer`, later; calls made in the meantime are held, up to 100.                                                            |
| `page`, `track`, `identify`, `group`, `error` | Only while the provider is active, which means its `requiredConsent` is met.                                                                                                                                                          |
| `teardown`                                    | When the requirement stops being met, when the provider is unregistered, and on `destroy()`.                                                                                                                                          |

Scripts already executed cannot be unloaded. A withdrawal therefore means
that ConsentLayer stops calling the provider, plus whatever the vendor's own
consent switch or opt-out does.

Providers receive `userId` under any consent they run with, and `email` and
`phone` only with marketing consent (see
[Identity storage](/internals/consent/#identity-storage)).

| Provider           | `id`            | `requiredConsent`                       | `loadBeforeConsent`             | `defer` | `teardown` |
| ------------------ | --------------- | --------------------------------------- | ------------------------------- | ------- | ---------- |
| GA4                | `ga4`           | `analytics`, or `none` in advanced mode | option, `true` in advanced mode | —       | —          |
| Google Tag Manager | `gtm`           | `none`, or the option                   | —                               | —       | —          |
| Meta Pixel         | `meta`          | `marketing`                             | option                          | —       | —          |
| PostHog            | `posthog`       | `none` (cookieless) or `analytics`      | —                               | option  | —          |
| Sentry             | `sentry`        | `none`                                  | —                               | option  | —          |
| Contentsquare      | `contentsquare` | `analytics`                             | —                               | —       | yes        |
| Hotjar             | `hotjar`        | `analytics`                             | —                               | —       | yes        |
| Vercel Analytics   | `vercel`        | `none`                                  | —                               | —       | —          |
| TikTok Pixel       | `tiktok`        | `marketing`                             | option                          | —       | —          |
| Google Ads         | `google-ads`    | `marketing`                             | —                               | option  | —          |
| Microsoft Clarity  | `clarity`       | `analytics`                             | —                               | option  | yes        |
| LinkedIn Insight   | `linkedin`      | `marketing`                             | —                               | option  | yes        |

A dash means the provider does not set that field. The `id` is the value to
use in `only` and the `providerId` in `onError`.

## GA4

`ga4({ measurementId, loadBeforeConsent?, consentMode? })` from `consentlayer/providers/ga4`.
The value is trimmed. An `undefined`, empty or whitespace-only
`measurementId` returns a stand-in plugin with only a `setup` hook that logs
the skip in debug mode. Any other value that does not match `G-` followed by 4 to 16 uppercase letters or digits throws.

| Hook       | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script     | `https://www.googletagmanager.com/gtag/js?id=<measurementId>`, unless another Google tag on the page loaded gtag.js first                                                                                                                                                                                                                                                                                                           |
| `setup`    | Creates `window.dataLayer` and `window.gtag` if absent. Unless a [`googleConsentMode()`](/internals/consent/#google-consent-mode) adapter set its window flag first, calls `gtag('consent', 'default', …)` with every key denied except `security_storage`. Then `gtag('js', new Date())`, and in advanced mode `config`.                                                                                                           |
| `consent`  | Without the adapter, `gtag('consent', 'update', …)` mapped as below, skipped while the visitor has never chosen so the defaults stay in force. In basic mode, on the first pass with analytics granted, also `gtag('config', measurementId, { send_page_view: false })`, once per measurement ID per page. In advanced mode, sets `user_id` and `user_data` from the identity while analytics is granted and clears them otherwise. |
| `load`     | Injects gtag.js, once per page for every Google tag. A failed load is reported with scope `provider-script-load`.                                                                                                                                                                                                                                                                                                                   |
| `page`     | `gtag('event', 'page_view', { page_location, page_path, page_title, send_to: measurementId })`                                                                                                                                                                                                                                                                                                                                      |
| `track`    | `gtag('event', ga4EventName(name), { ...params, ...providers.ga4, send_to: measurementId })`                                                                                                                                                                                                                                                                                                                                        |
| `identify` | `gtag('set', { user_id })` when there is a user ID, then `gtag('set', 'user_data', { email, phone_number })` with whichever fields are present. In advanced mode, only while analytics is granted.                                                                                                                                                                                                                                  |
| `reset`    | `gtag('set', { user_id: null })` and `gtag('set', 'user_data', {})`                                                                                                                                                                                                                                                                                                                                                                 |
| Withdrawal | The `consent` hook sends the denied Consent Mode update and, while analytics is denied, expires the `_ga`, `_ga_<id>` and `_gid` cookies on the current host and every parent domain; the manager stops sending events.                                                                                                                                                                                                             |

| Consent Mode key                                   | Follows          |
| -------------------------------------------------- | ---------------- |
| `analytics_storage`                                | analytics        |
| `ad_storage`, `ad_user_data`, `ad_personalization` | marketing        |
| `functionality_storage`                            | preferences      |
| `security_storage`                                 | always `granted` |

In basic mode `config` waits for analytics consent on purpose. With
`loadBeforeConsent`, gtag.js is on the page from boot but has no `config`, so
it sends no cookieless pings before the visitor agrees. Advanced mode
configures the tag in `setup` and runs with `requiredConsent: 'none'`, so
`page` and `track` reach gtag before consent and Google sends cookieless
pings while `analytics_storage` is denied.

**Names.** `lead` becomes `generate_lead`. Any character other than a letter,
digit or `_` becomes `_`, so `consentlayer.scroll_depth` is sent as
`consentlayer_scroll_depth`.

**Personal data.** `user_id` with analytics consent. Email and phone go into
`user_data` only with marketing consent; the phone is prefixed with `+` if
needed, and gtag hashes both itself.

## Google Tag Manager

`gtm({ containerId, requiredConsent?, serverContainerUrl? })` from
`consentlayer/providers/gtm`. The value is trimmed. An `undefined`, empty or
whitespace-only `containerId` returns a stand-in plugin with only a `setup`
hook that logs the skip in debug mode. Any other value that does not match
`GTM-` followed by 4 to 12 uppercase letters or digits throws.

`requiredConsent` defaults to `'none'`: the container loads at boot, and its
tags are expected to follow Consent Mode. With a category, nothing loads until
that category is granted. The provider never sets `loadBeforeConsent`.

| Hook       | Behavior                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Script     | `https://www.googletagmanager.com/gtm.js?id=<containerId>`, or `<serverContainerUrl>/gtm.js?id=<containerId>` when `serverContainerUrl` is set. The URL must be HTTPS or a relative path, and a trailing `/` is removed.                                                                                           |
| `setup`    | Creates `window.dataLayer` and `window.gtag` if absent. Unless a [`googleConsentMode()`](/internals/consent/#google-consent-mode) adapter set its window flag first, calls `gtag('consent', 'default', …)` with every key denied except `security_storage`, shared with `ga4()` so the defaults go out once.       |
| `consent`  | Without the adapter, `gtag('consent', 'update', …)` mapped as for GA4, skipped while the visitor has never chosen. Whenever the consent changes, pushes `{ event: 'consentlayer_consent', consent }` to `dataLayer`. Pushes the user ID as for `identify` below.                                                   |
| `load`     | Once per container ID per page: pushes `{ 'gtm.start': Date.now(), event: 'gtm.js' }`, then injects `gtm.js`. A failed load is reported with scope `provider-script-load` and the message `Failed to load Google Tag Manager container <containerId>`.                                                             |
| `page`     | Pushes `{ event: 'page_view', page_location, page_path, page_title }`                                                                                                                                                                                                                                              |
| `track`    | Pushes `{ ...params, ...providers.gtm, event: name }`. The name is not translated.                                                                                                                                                                                                                                 |
| `identify` | Pushes `{ event: 'consentlayer_identify', user_id }` only while analytics is granted, and only when the user ID differs from the last one pushed.                                                                                                                                                                  |
| `reset`    | Pushes `{ event: 'consentlayer_identify', user_id: null }` if a user ID was pushed before.                                                                                                                                                                                                                         |
| Withdrawal | The `consent` hook sends the denied Consent Mode update, pushes the new consent and clears the user ID. With the default `'none'`, the manager keeps sending `page` and `track`, and the container's tags decide what to do under Consent Mode. With a category, the manager stops once the category is withdrawn. |

The Consent Mode keys follow the same table as GA4. The container can
trigger tags on the `consentlayer_consent`, `consentlayer_identify` and
`page_view` events, and on each event name passed to `track`.

**Personal data.** `user_id` with analytics consent, in the
`consentlayer_identify` event. Email and phone are never pushed. `track`
passes `params` through as they are, so anything you put in them reaches
the data layer.

## Meta Pixel

`meta({ pixelId, locale?, loadBeforeConsent? })` from
`consentlayer/providers/meta`. The value is trimmed; an `undefined`, empty or
whitespace-only `pixelId` turns the provider off, and the factory throws if
it is not an 8 to 20 digit string.

| Hook                         | Behavior                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script                       | `https://connect.facebook.net/<locale>/fbevents.js`, default locale `en_US`                                                                                                                                                                                                                                                            |
| `load`                       | Skipped if a pixel was already initialized on the page. Otherwise runs an inline bootstrap that defines the `fbq` queue, calls `fbq('consent', 'grant' \| 'revoke')` from the current consent, then `fbq('init', pixelId, advancedMatching)`; then injects `fbevents.js`. A failed load is reported with scope `provider-script-load`. |
| `consent`                    | `fbq('consent', 'grant')` with marketing consent, otherwise `fbq('consent', 'revoke')`.                                                                                                                                                                                                                                                |
| `page`                       | `fbq('track', 'PageView', {}, { eventID })`                                                                                                                                                                                                                                                                                            |
| `track`                      | `fbq('track' \| 'trackCustom', name, params, { eventID })`                                                                                                                                                                                                                                                                             |
| `teardown`                   | Only if marketing consent is no longer granted: expires the `_fbp` and `_fbc` cookies on the current host and every parent domain.                                                                                                                                                                                                     |
| `identify`, `reset`, `group` | Not implemented.                                                                                                                                                                                                                                                                                                                       |

Because `consent` is called before `init` in the bootstrap, a pixel loaded
with `loadBeforeConsent` starts revoked and sends nothing until marketing is
granted. `page` and `track` also check marketing consent themselves.

**Names.** Standard events map to Meta's (`purchase` → `Purchase`,
`add_to_cart` → `AddToCart`; the full list is in [Events](/guides/events/)).
Other names are sent with `trackCustom` under their own name. `items` becomes
`content_ids`, `contents`, `content_type: 'product'` and `num_items`;
`search_term` becomes `search_string`; `providers.meta` is merged last.

**Personal data.** Meta accepts advanced matching only in `fbq('init')`, so
it is taken from the identity at load time: `em` (email), `ph` (phone digits)
and `external_id` (user ID). The pixel hashes them. Email and phone are
present only if marketing consent was granted at that point. An `identify()`
after the pixel has loaded does not reach the pixel until the next page load;
the server route still sends it (see [Server forwarding](/internals/server/)).

**Withdrawal after matching.** The pixel keeps `init`'s email and phone for
the lifetime of the page. If it was initialized with them and marketing is
then withdrawn, the provider keeps the pixel revoked and silent until the page
reloads, even if marketing is granted again.

**Deduplication.** Each `page` and `track` passes `eventID`, the same ID the
server route sends to the Conversions API.

## PostHog

`posthog({ apiKey, apiHost?, uiHost?, cookieless?, autocapture?, recording?, errors?, groupType?, defer? })`
from `consentlayer/providers/posthog`. `posthog-js` is imported dynamically
in `load`.

| Hook        | Behavior                                                                                                                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement | `none` with `cookieless` (default); `analytics` with `cookieless: false`                                                                                                                                                      |
| `load`      | Imports `posthog-js` and calls `init` with the options below, then applies the latest consent.                                                                                                                                |
| `consent`   | Stores the context. Once the SDK is loaded, applies it: without analytics, `opt_out_capturing()`; with analytics, `opt_in_capturing()`, then `identify(userId)` if there is one, then session recording if `recording: true`. |
| `page`      | `capture('$pageview', { $current_url, title })`                                                                                                                                                                               |
| `track`     | `capture(name, { ...params, ...providers.posthog })`                                                                                                                                                                          |
| `identify`  | `identify(userId, { ...traits, email? })`, only with analytics consent and a user ID.                                                                                                                                         |
| `group`     | `group(groupType ?? 'company', groupId, traits)`, only with analytics consent.                                                                                                                                                |
| `reset`     | `reset()`, then re-applies the current consent.                                                                                                                                                                               |
| `error`     | `captureException(error, { level, ...tags, ...extra })`, unless `errors: false`.                                                                                                                                              |
| `teardown`  | Not implemented; the `consent` hook has already opted out.                                                                                                                                                                    |

<details>
<summary><code>init</code> options</summary>

| Option                                                                                                                  | Value                                          |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `api_host`                                                                                                              | `apiHost`, default `https://us.i.posthog.com`  |
| `ui_host`                                                                                                               | `uiHost`                                       |
| `cookieless_mode`                                                                                                       | `'on_reject'` when cookieless, otherwise unset |
| `opt_out_capturing_by_default`, `opt_out_persistence_by_default`                                                        | `true`                                         |
| `autocapture`                                                                                                           | `autocapture`, default `false`                 |
| `capture_pageview`, `capture_pageleave`, `capture_exceptions`, `capture_heatmaps`, `capture_dead_clicks`                | `false`                                        |
| `disable_session_recording`, `disable_surveys`, `advanced_disable_feature_flags`, `disable_external_dependency_loading` | `true`                                         |
| `advanced_disable_flags`                                                                                                | `true`, or `false` with `recording`            |

PostHog starts a recording only when the project's remote config, fetched
from `<apiHost>/array/<apiKey>/config` when PostHog loads, has recording
enabled. `advanced_disable_flags` also turns that fetch off, so it stays on
with `recording`; `advanced_disable_feature_flags` still keeps feature flags
off. The session recorder (`posthog-js/dist/posthog-recorder`) is imported
only when `recording: true` and analytics consent is granted.

</details>

**Cookieless mode.** Before analytics consent PostHog is opted out, which in
`on_reject` mode means it counts events without cookies or storage. This
requires cookieless mode to be enabled in the PostHog project settings.
Events sent before consent are anonymous; no user identity is passed until
analytics is granted.

**Names.** Unchanged.

**Personal data.** User ID with analytics consent; email, as a trait on
`identify`, only with marketing consent as well.

## Sentry

`sentry({ dsn, environment?, release?, replay?, tracing?, tunnel?, defer? })`
from `consentlayer/providers/sentry`. `@sentry/browser` is imported
dynamically in `load`, and Replay and tracing are separate chunks.

| Hook                     | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement              | `none`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `load`                   | Imports the SDK and calls `init` (below), then applies the latest consent.                                                                                                                                                                                                                                                                                                                                                  |
| `consent`                | Stores the context. Once the SDK is loaded: `setUser({ id, email })` with analytics consent and a user ID, otherwise `setUser(null)`. With `replay` and analytics consent, adds the Replay integration the first time and calls its `startBuffering()` on every later application; without analytics consent, calls its `stop()`. With `tracing`, adds the tracing integration the first time analytics consent is granted. |
| `page`, `track`, `group` | Not implemented.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `identify`               | Re-applies `setUser` and the integrations from the current consent.                                                                                                                                                                                                                                                                                                                                                         |
| `reset`                  | `setUser(null)`                                                                                                                                                                                                                                                                                                                                                                                                             |
| `error`                  | `captureException(error, { level, tags: { ...tags, source }, extra })`                                                                                                                                                                                                                                                                                                                                                      |

<details>
<summary><code>init</code> options</summary>

| Option                                                 | Value                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `dsn`, `environment`, `release`, `tunnel`              | From the options                                                                        |
| `dataCollection`                                       | `userInfo`, `cookies`, `httpHeaders` and `urlQueryParams` `false`; `httpBodies` empty   |
| `integrations`                                         | Sentry's defaults without `GlobalHandlers`                                              |
| `tracesSampleRate`                                     | `tracing.sampleRate ?? 1` when tracing is on                                            |
| `replaysSessionSampleRate`, `replaysOnErrorSampleRate` | `replay.sessionSampleRate ?? 0.1` and `replay.onErrorSampleRate ?? 1` when Replay is on |
| `beforeSendTransaction`                                | Drops every transaction while analytics consent is not granted                          |

</details>

**Errors without consent.** Error reports are treated as necessary for
operating the site, so they are sent under any consent, without IP address,
cookies, headers, bodies or query strings. Uncaught errors reach Sentry
through ConsentLayer's own `error` and `unhandledrejection` listeners, which
is why Sentry's `GlobalHandlers` integration is removed; this avoids
duplicates. Turn the listeners off with `errors: false` or
`errors: { globalHandlers: false }` on `createAnalytics`.

**Replay and tracing** require analytics consent. A tracing integration
cannot be removed once added, so after a withdrawal its transactions are
dropped by `beforeSendTransaction`. A grant after a withdrawal only buffers
Replay for errors; full session recording resumes on the next page load.

**Personal data.** User ID with analytics consent; email with analytics and
marketing consent.

## Contentsquare

`contentsquare({ tagId })` from `consentlayer/providers/contentsquare`.

| Hook       | Behavior                                                                                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script     | `https://t.contentsquare.net/uxa/<tagId>.js`                                                                                                                                                                                      |
| `load`     | Skipped if the tag was already initialized on the page. Otherwise defines the `window._uxa` command queue, remembers the current path and injects the tag. The tag sends the first page view itself. Script failures are ignored. |
| `consent`  | With analytics consent, expires the `_cs_optout` cookie on the current host and every parent domain.                                                                                                                              |
| `page`     | `['trackPageview', path]`, with the query string and hash removed. The first page view after `load` is skipped if its path equals the path the tag loaded on.                                                                     |
| `track`    | `['trackPageEvent', name]`; params are not sent. `purchase` instead sends `['ec:transaction:create', { id: transaction_id, revenue: value, currency }]` followed by `['ec:transaction:send']`.                                    |
| `identify` | `['identify', userId]` when there is a user ID                                                                                                                                                                                    |
| `reset`    | `['resetIdentity']`                                                                                                                                                                                                               |
| `teardown` | `['optout']`, only if analytics consent is no longer granted and the tag was initialized                                                                                                                                          |

`['optout']` is Contentsquare's opt-out command. Contentsquare has no web
command to opt back in, so when analytics is granted again the provider
deletes the `_cs_optout` cookie and collection resumes on the next page load.
See [Contentsquare's consent documentation](https://docs.contentsquare.com/en/web/send-the-users-decisions-about-data-collection/).

**Personal data.** User ID with analytics consent. Email is never sent;
Contentsquare advises against identifying visitors by email.

## Hotjar

:::caution[Deprecated]
Hotjar accounts are moving to Contentsquare, after which the Hotjar account
stops collecting. Switch to [`contentsquare`](#contentsquare) once yours has
moved; `hotjar` will be removed in the next major version.
:::

`hotjar({ siteId, version, reloadOnRevoke? })` from
`consentlayer/providers/hotjar`.

| Hook       | Behavior                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Options    | `siteId` and `version` accept positive integers, as numbers or as strings of digits; surrounding whitespace is trimmed. Either one `undefined`, `''` or whitespace turns the provider off; any other value, such as `'1e3'` or `'12.0'`, throws when `hotjar()` is called. |
| Script     | `https://static.hotjar.com/c/hotjar-<siteId>.js?sv=<version>`                                                                                                                                                                                                              |
| `load`     | Skipped if Hotjar was already initialized on the page. Otherwise defines a queueing `window.hj` and `window._hjSettings = { hjid, hjsv }` and injects the script. Script failures are ignored.                                                                             |
| `page`     | Not implemented; Hotjar tracks page views itself.                                                                                                                                                                                                                          |
| `track`    | `hj('event', name)`; params are not sent.                                                                                                                                                                                                                                  |
| `identify` | `hj('identify', userId ?? null, { ...traits, email? })`                                                                                                                                                                                                                    |
| `reset`    | `hj('identify', null, {})`                                                                                                                                                                                                                                                 |
| `teardown` | Only if analytics consent is no longer granted: expires every `_hj*` cookie on the current host and every parent domain, removes every key starting with `hj` or `_hj` from localStorage and sessionStorage, then reloads the page if `reloadOnRevoke` is set.             |

Hotjar cannot be switched off once loaded: it keeps recording until the page
unloads. Clearing its storage prevents it from recognizing the visitor later,
and `reloadOnRevoke: true` also ends the current recording.

**Personal data.** User ID with analytics consent; email only when there is
also a user ID and marketing consent is granted.

## Vercel Analytics

`vercel({ trackEvent })` from `consentlayer/providers/vercel`, where
`trackEvent` is `track` from `@vercel/analytics`.

| Hook            | Behavior                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load`          | Not implemented. Render Vercel's `<Analytics />` yourself; it also counts page views.                                                                                                  |
| `track`         | `trackEvent(name, params)` with params flattened: strings, numbers and booleans kept, `null` and `undefined` sent as `null`, `Date` values as ISO strings, objects and arrays dropped. |
| All other hooks | Not implemented.                                                                                                                                                                       |

**Personal data.** None; identity is never passed.

## TikTok Pixel

`tiktok({ pixelId, loadBeforeConsent? })` from `consentlayer/providers/tiktok`.
The value is trimmed; an `undefined`, empty or whitespace-only `pixelId` turns
the provider off.

| Hook             | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script           | `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=<pixelId>&lib=ttq`                                                                                                                                                                                                                                                                                                                                                      |
| `load`           | Skipped if a pixel was already initialized on the page. Otherwise runs an inline bootstrap, TikTok's base code with the consent mode methods added and without its script injection and `ttq.page()`, that defines the `ttq` queue, calls `ttq.grantConsent()` or `ttq.holdConsent()` from the current consent, then `ttq.load(pixelId)`; then injects `events.js`. A failed load is reported with scope `provider-script-load`. |
| `consent`        | `ttq.grantConsent()` with marketing consent, otherwise `ttq.revokeConsent()`.                                                                                                                                                                                                                                                                                                                                                    |
| `identify`       | `ttq.identify({ email, phone_number, external_id })`, when the identity has any of them.                                                                                                                                                                                                                                                                                                                                         |
| `page`           | `ttq.page()`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `track`          | `ttq.track(name, params, { event_id })`                                                                                                                                                                                                                                                                                                                                                                                          |
| `teardown`       | Only if marketing consent is no longer granted: expires the `_ttp`, `ttclid` and `ttcsid*` cookies on the current host and every parent domain.                                                                                                                                                                                                                                                                                  |
| `reset`, `group` | Not implemented.                                                                                                                                                                                                                                                                                                                                                                                                                 |

Because consent is held before `ttq.load` in the bootstrap, a pixel loaded
with `loadBeforeConsent` shares nothing until marketing is granted. `page`,
`track` and `identify` also check marketing consent themselves.

**Names.** Standard events map to TikTok's (`purchase` → `Purchase`,
`add_to_cart` → `AddToCart`; the full list is in [Events](/guides/events/)).
Other names are sent under their own name. `items` becomes `content_ids`,
`contents`, `content_type: 'product'` and `num_items`; `search_term` becomes
`search_string` and `transaction_id` becomes `order_id`; `providers.tiktok` is
merged last.

**Personal data.** `email` is trimmed and lowercased, `phone_number` is the
phone's digits prefixed with `+`, and `external_id` is the user ID. The pixel
hashes them. Email and phone are present only with marketing consent.

**Withdrawal after matching.** If the pixel received an email or phone and
marketing is then withdrawn, the provider keeps the pixel revoked and silent
until the page reloads, even if marketing is granted again.

**Deduplication.** Each `track` passes `event_id`, the same ID the server
route sends to the Events API. `ttq.page()` takes no event ID, so the Events
API destination skips page views.

## Google Ads

`googleAds({ conversionId, conversions?, pageViews?, defer? })` from
`consentlayer/providers/google-ads`. The value is trimmed; an `undefined`,
empty or whitespace-only `conversionId` turns the provider off, and any other
value that does not match `AW-` followed by digits throws.

| Hook        | Behavior                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script      | `https://www.googletagmanager.com/gtag/js?id=<conversionId>`, unless another Google tag on the page loaded gtag.js first                                                                                                                                |
| `setup`     | Creates `window.dataLayer` and `window.gtag` if absent and, unless a `googleConsentMode()` adapter is on the page, sets the Consent Mode defaults, shared with `ga4()` and `gtm()` so they go out once.                                                 |
| `consent`   | Without the adapter, `gtag('consent', 'update', …)` mapped as for GA4. While marketing is denied, expires the `_gcl_*` cookies on the current host and every parent domain.                                                                             |
| `load`      | Once per conversion ID per page: `gtag('js', new Date())` unless another Google tag already sent it, then `gtag('config', conversionId, { send_page_view: false })`, then injects gtag.js. A failed load is reported with scope `provider-script-load`. |
| `page`      | `gtag('event', 'page_view', { page_location, page_path, page_title, send_to: conversionId })`, unless `pageViews` is `false`                                                                                                                            |
| `track`     | Only for event names in `conversions`: `gtag('event', 'conversion', { value, currency, transaction_id, ...providers['google-ads'], send_to: '<conversionId>/<label>' })`, with each of the three params only when set. Other events are not sent.       |
| Other hooks | Not implemented.                                                                                                                                                                                                                                        |

**Personal data.** None is passed; the tag sets its own cookies.

## Microsoft Clarity

`clarity({ projectId, events?, identify?, defer? })` from
`consentlayer/providers/clarity`. The value is trimmed; an `undefined`, empty
or whitespace-only `projectId` turns the provider off, and a value with other
characters than letters and digits throws.

| Hook        | Behavior                                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Script      | `https://www.clarity.ms/tag/<projectId>`                                                                                                                                                                                                                           |
| `load`      | Skipped if the provider already loaded Clarity on the page. Otherwise defines a queueing `window.clarity` if absent, calls `clarity('consentv2', …)` with the current consent and injects the script. A failed load is reported with scope `provider-script-load`. |
| `consent`   | While analytics is granted and Clarity is loaded, `clarity('consentv2', { ad_Storage, analytics_Storage })` when either signal changed: `ad_Storage` follows marketing and `analytics_Storage` analytics.                                                          |
| `track`     | `clarity('event', name)`; params are not sent. Skipped with `events: false`.                                                                                                                                                                                       |
| `identify`  | `clarity('identify', userId)` when there is a user ID. Skipped with `identify: false`.                                                                                                                                                                             |
| `teardown`  | Only if analytics consent is no longer granted: `clarity('consent', false)`, which erases Clarity's cookies and stops tracking until consent is given again.                                                                                                       |
| Other hooks | Not implemented; Clarity records page views itself.                                                                                                                                                                                                                |

See [Clarity's consent API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2).

**Personal data.** User ID with analytics consent. Email is never sent.

## LinkedIn Insight

`linkedin({ partnerId, conversions?, defer? })` from
`consentlayer/providers/linkedin`. `partnerId` is a number or a string of
digits; the value is trimmed, `undefined`, empty or whitespace turns the
provider off, and any other value throws.

| Hook        | Behavior                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script      | `https://snap.licdn.com/li.lms-analytics/insight.min.js`                                                                                                                                                                                                                                                |
| `load`      | Skipped if the provider already loaded the tag on the page. Otherwise sets `window._linkedin_partner_id`, adds the partner ID to `window._linkedin_data_partner_ids`, defines a queueing `window.lintrk` if absent and injects the script. A failed load is reported with scope `provider-script-load`. |
| `track`     | Only for event names in `conversions`: `lintrk('track', { conversion_id, event_id })`, where `event_id` is the event's ID. Other events are not sent.                                                                                                                                                   |
| `teardown`  | Only if marketing consent is no longer granted: expires the first-party cookies in [LinkedIn's cookie table](https://www.linkedin.com/legal/l/cookie-table), `li_fat_id`, `li_giant`, `oribi_cookie_test`, `oribili_user_guid`, `ln_or` and `ar_debug`, on the current host and every parent domain.    |
| Other hooks | Not implemented. The tag records the page load itself.                                                                                                                                                                                                                                                  |

The Insight Tag has no consent switch: once loaded, it runs until the page
unloads. After withdrawal, ConsentLayer stops sending conversions to it.

**Personal data.** None is passed; the tag sets its own cookies.
