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

| Hook | When it runs |
|---|---|
| `setup` | Once, on the first lifecycle pass after `boot()`, whatever the consent. |
| `consent` | On every lifecycle pass (boot, each consent change, each registration after boot), for every provider, before `load`. Providers that are not allowed to run still receive it, which is how vendor consent modes learn about a denial. |
| `load` | Once, on the first pass where the provider's requirement is met, or at boot with `loadBeforeConsent`. With `defer`, later; calls made in the meantime are held, up to 100. |
| `page`, `track`, `identify`, `group`, `error` | Only while the provider is active, which means its `requiredConsent` is met. |
| `teardown` | When the requirement stops being met, when the provider is unregistered, and on `destroy()`. |

Scripts already executed cannot be unloaded. A withdrawal therefore means
that ConsentLayer stops calling the provider, plus whatever the vendor's own
consent switch or opt-out does.

Providers receive `userId` under any consent they run with, and `email` and
`phone` only with marketing consent (see
[Identity storage](/internals/consent/#identity-storage)).

| Provider | `id` | `requiredConsent` | `loadBeforeConsent` | `defer` | `teardown` |
|---|---|---|---|---|---|
| GA4 | `ga4` | `analytics` | option | — | — |
| Meta Pixel | `meta` | `marketing` | option | — | — |
| PostHog | `posthog` | `none` (cookieless) or `analytics` | — | option | — |
| Sentry | `sentry` | `none` | — | option | — |
| Contentsquare | `contentsquare` | `analytics` | — | — | yes |
| Hotjar | `hotjar` | `analytics` | — | — | yes |
| Vercel Analytics | `vercel` | `none` | — | — | — |
| TikTok | `tiktok` | `marketing` | — | — | — |

A dash means the provider does not set that field. The `id` is the value to
use in `only` and the `providerId` in `onError`.

## GA4

`ga4({ measurementId, loadBeforeConsent? })` from `consentlayer/providers/ga4`.
An `undefined` or empty `measurementId` returns a stand-in plugin with only a
`setup` hook that logs the skip in debug mode. Any other value that does not
match `G-` followed by 4 to 16 uppercase letters or digits throws.

| Hook | Behaviour |
|---|---|
| Script | `https://www.googletagmanager.com/gtag/js?id=<measurementId>` |
| `setup` | Creates `window.dataLayer` and `window.gtag` if absent, then calls `gtag('consent', 'default', …)` with every key denied except `security_storage`, then `gtag('js', new Date())`. |
| `consent` | `gtag('consent', 'update', …)` mapped as below. On the first pass with analytics granted, also `gtag('config', measurementId, { send_page_view: false })`, once per measurement ID per page. |
| `load` | Injects gtag.js. A failed load is reported with scope `provider-script-load`. |
| `page` | `gtag('event', 'page_view', { page_location, page_path, page_title })` |
| `track` | `gtag('event', ga4EventName(name), { ...params, ...providers.ga4 })` |
| `identify` | `gtag('set', { user_id })` when there is a user ID, then `gtag('set', 'user_data', { email, phone_number })` with whichever fields are present. |
| `reset` | `gtag('set', { user_id: null })` and `gtag('set', 'user_data', {})` |
| Withdrawal | The `consent` hook sends the denied Consent Mode update; the manager stops sending events. |

| Consent Mode key | Follows |
|---|---|
| `analytics_storage` | analytics |
| `ad_storage`, `ad_user_data`, `ad_personalization` | marketing |
| `functionality_storage` | preferences |
| `security_storage` | always `granted` |

`config` waits for analytics consent on purpose. With `loadBeforeConsent`,
gtag.js is on the page from boot but has no `config`, so it sends no
cookieless pings before the visitor agrees.

**Names.** `lead` becomes `generate_lead`. Any character other than a letter,
digit or `_` becomes `_`, so `consentlayer.scroll_depth` is sent as
`consentlayer_scroll_depth`.

**Personal data.** `user_id` with analytics consent. Email and phone go into
`user_data` only with marketing consent; the phone is prefixed with `+` if
needed, and gtag hashes both itself.

## Meta Pixel

`meta({ pixelId, locale?, loadBeforeConsent? })` from
`consentlayer/providers/meta`. The factory throws if `pixelId` is not an 8 to
20 digit string.

| Hook | Behaviour |
|---|---|
| Script | `https://connect.facebook.net/<locale>/fbevents.js`, default locale `en_US` |
| `load` | Skipped if a pixel was already initialised on the page. Otherwise runs an inline bootstrap that defines the `fbq` queue, calls `fbq('consent', 'grant' \| 'revoke')` from the current consent, then `fbq('init', pixelId, advancedMatching)`; then injects `fbevents.js`. A failed load is reported with scope `provider-script-load`. |
| `consent` | `fbq('consent', 'grant')` with marketing consent, otherwise `fbq('consent', 'revoke')`. |
| `page` | `fbq('track', 'PageView', {}, { eventID })` |
| `track` | `fbq('track' \| 'trackCustom', name, params, { eventID })` |
| `identify`, `reset`, `group`, `teardown` | Not implemented. |

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
the lifetime of the page. If it was initialised with them and marketing is
then withdrawn, the provider keeps the pixel revoked and silent until the page
reloads, even if marketing is granted again.

**Deduplication.** Each `page` and `track` passes `eventID`, the same ID the
server route sends to the Conversions API.

## PostHog

`posthog({ apiKey, apiHost?, uiHost?, cookieless?, autocapture?, recording?, errors?, groupType?, defer? })`
from `consentlayer/providers/posthog`. `posthog-js` is imported dynamically
in `load`.

| Hook | Behaviour |
|---|---|
| Requirement | `none` with `cookieless` (default); `analytics` with `cookieless: false` |
| `load` | Imports `posthog-js` and calls `init` with the options below, then applies the latest consent. |
| `consent` | Stores the context. Once the SDK is loaded, applies it: without analytics, `opt_out_capturing()`; with analytics, `opt_in_capturing()`, then `identify(userId)` if there is one, then session recording if `recording: true`. |
| `page` | `capture('$pageview', { $current_url, title })` |
| `track` | `capture(name, { ...params, ...providers.posthog })` |
| `identify` | `identify(userId, { ...traits, email? })`, only with analytics consent and a user ID. |
| `group` | `group(groupType ?? 'company', groupId, traits)`, only with analytics consent. |
| `reset` | `reset()`, then re-applies the current consent. |
| `error` | `captureException(error, { level, ...tags, ...extra })`, unless `errors: false`. |
| `teardown` | Not implemented; the `consent` hook has already opted out. |

<details>
<summary><code>init</code> options</summary>

| Option | Value |
|---|---|
| `api_host` | `apiHost`, default `https://us.i.posthog.com` |
| `ui_host` | `uiHost` |
| `cookieless_mode` | `'on_reject'` when cookieless, otherwise unset |
| `opt_out_capturing_by_default`, `opt_out_persistence_by_default` | `true` |
| `autocapture` | `autocapture`, default `false` |
| `capture_pageview`, `capture_pageleave`, `capture_exceptions`, `capture_heatmaps`, `capture_dead_clicks` | `false` |
| `disable_session_recording`, `disable_surveys`, `advanced_disable_flags`, `disable_external_dependency_loading` | `true` |

The session recorder (`posthog-js/dist/recorder`) is imported only when
`recording: true` and analytics consent is granted.

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

| Hook | Behaviour |
|---|---|
| Requirement | `none` |
| `load` | Imports the SDK and calls `init` (below), then applies the latest consent. |
| `consent` | Stores the context. Once the SDK is loaded: `setUser({ id, email })` with analytics consent and a user ID, otherwise `setUser(null)`. With `replay` and analytics consent, adds the Replay integration the first time and calls its `startBuffering()` on every later application; without analytics consent, calls its `stop()`. With `tracing`, adds the tracing integration the first time analytics consent is granted. |
| `page`, `track`, `group` | Not implemented. |
| `identify` | Re-applies `setUser` and the integrations from the current consent. |
| `reset` | `setUser(null)` |
| `error` | `captureException(error, { level, tags: { ...tags, source }, extra })` |

<details>
<summary><code>init</code> options</summary>

| Option | Value |
|---|---|
| `dsn`, `environment`, `release`, `tunnel` | From the options |
| `dataCollection` | `userInfo`, `cookies`, `httpHeaders` and `urlQueryParams` `false`; `httpBodies` empty |
| `integrations` | Sentry's defaults without `GlobalHandlers` |
| `tracesSampleRate` | `tracing.sampleRate ?? 1` when tracing is on |
| `replaysSessionSampleRate`, `replaysOnErrorSampleRate` | `replay.sessionSampleRate ?? 0.1` and `replay.onErrorSampleRate ?? 1` when Replay is on |
| `beforeSendTransaction` | Drops every transaction while analytics consent is not granted |

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

| Hook | Behaviour |
|---|---|
| Script | `https://t.contentsquare.net/uxa/<tagId>.js` |
| `load` | Skipped if the tag was already initialised on the page. Otherwise defines the `window._uxa` command queue, remembers the current path and injects the tag. The tag sends the first page view itself. Script failures are ignored. |
| `consent` | With analytics consent, expires the `_cs_optout` cookie on the current host and every parent domain. |
| `page` | `['trackPageview', path]`, with the query string and hash removed. The first page view after `load` is skipped if its path equals the path the tag loaded on. |
| `track` | `['trackPageEvent', name]`; params are not sent. `purchase` instead sends `['ec:transaction:create', { id: transaction_id, revenue: value, currency }]` followed by `['ec:transaction:send']`. |
| `identify` | `['identify', userId]` when there is a user ID |
| `reset` | `['resetIdentity']` |
| `teardown` | `['optout']`, only if analytics consent is no longer granted and the tag was initialised |

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

| Hook | Behaviour |
|---|---|
| Options | `siteId` and `version` accept numbers or numeric strings. Either one `undefined` or `''` turns the provider off; any other value that is not a positive safe integer throws when `hotjar()` is called. |
| Script | `https://static.hotjar.com/c/hotjar-<siteId>.js?sv=<version>` |
| `load` | Skipped if Hotjar was already initialised on the page. Otherwise defines a queueing `window.hj` and `window._hjSettings = { hjid, hjsv }` and injects the script. Script failures are ignored. |
| `page` | Not implemented; Hotjar tracks page views itself. |
| `track` | `hj('event', name)`; params are not sent. |
| `identify` | `hj('identify', userId ?? null, { ...traits, email? })` |
| `reset` | `hj('identify', null, {})` |
| `teardown` | Only if analytics consent is no longer granted: expires every `_hj*` cookie on the current host and every parent domain, removes every key starting with `hj` or `_hj` from localStorage and sessionStorage, then reloads the page if `reloadOnRevoke` is set. |

Hotjar cannot be switched off once loaded: it keeps recording until the page
unloads. Clearing its storage prevents it from recognising the visitor later,
and `reloadOnRevoke: true` also ends the current recording.

**Personal data.** User ID with analytics consent; email only when there is
also a user ID and marketing consent is granted.

## Vercel Analytics

`vercel({ trackEvent })` from `consentlayer/providers/vercel`, where
`trackEvent` is `track` from `@vercel/analytics`.

| Hook | Behaviour |
|---|---|
| `load` | Not implemented. Render Vercel's `<Analytics />` yourself; it also counts page views. |
| `track` | `trackEvent(name, params)` with params flattened: strings, numbers and booleans kept, `null` and `undefined` sent as `null`, `Date` values as ISO strings, objects and arrays dropped. |
| All other hooks | Not implemented. |

**Personal data.** None; identity is never passed.

## TikTok

`tiktok()` from `consentlayer/providers/tiktok`.

| Hook | Behaviour |
|---|---|
| `consent` | If `window.ttq` is a function: `ttq('consent', 'grant')` with marketing consent, otherwise `ttq('consent', 'reject')`. |
| All other hooks | Not implemented. Load the TikTok pixel and send its events yourself. |

The provider exists only to forward consent to a pixel you manage.
