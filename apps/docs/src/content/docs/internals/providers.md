---
title: What each provider receives
description: Exactly what each built-in provider loads, sends and clears, and under which consent.
sidebar:
  order: 3
---

This page lists, for each built-in provider, what reaches the vendor and when.
Setup and options are in [Providers](/guides/providers/); event names in
[Events](/guides/events/).

## Rules that apply to every provider

The analytics manager drives each provider the same way (details in
[Lifecycle](/internals/lifecycle/)):

- **`setup`** runs once, on the first evaluation after `boot()`, whatever the consent.
- **`consent`** runs on every consent change, for every provider, before
  loading. That's how providers that aren't allowed to run still hear "denied".
- **`load`** runs once, when the provider's category is granted, or at boot
  with `loadBeforeConsent: true`. With `defer`, it waits until the given
  moment and calls made meanwhile are queued (up to 100).
- **`page`, `track`, `identify`, `group`, `error`** reach a provider only while
  it is active, meaning its required category is granted.
- **`teardown`** runs when the category is withdrawn (and on `destroy()`).
  Scripts already on the page can't be unloaded, so withdrawal means: no more
  calls from consentlayer, plus whatever the vendor's own consent switch does.
- **Identity.** Providers get `userId` under any consent they run with; `email`
  and `phone` only with marketing. See [Consent](/internals/consent/#identity-storage).

Built-in providers have no `teardown` unless listed below.

## GA4

`ga4({ measurementId, loadBeforeConsent? })` from `consentlayer/providers/ga4`.

| | |
|---|---|
| Required category | `analytics` |
| Script | `https://www.googletagmanager.com/gtag/js?id=<measurementId>` |
| Loads | on analytics consent; at boot with `loadBeforeConsent: true` |
| Setup (always) | creates `window.dataLayer` and `window.gtag`, then `gtag('consent', 'default', …)` all denied except `security_storage`, then `gtag('js', new Date())` |
| On each consent change | `gtag('consent', 'update', …)` mapped as below |
| First analytics grant | `gtag('config', measurementId, { send_page_view: false })`, once per measurement ID |
| `page` | `gtag('event', 'page_view', { page_location, page_path, page_title })` |
| `track` | `gtag('event', ga4EventName(name), { ...params, ...providers.ga4 })` |
| `identify` | `gtag('set', { user_id })` if there's a user ID; `gtag('set', 'user_data', { email, phone_number })` |
| `reset` | `user_id: null`, `user_data: {}` |
| Withdrawal | Consent Mode update to denied; no more events |

Consent Mode mapping:

| Consent Mode key | Follows |
|---|---|
| `analytics_storage` | analytics |
| `ad_storage`, `ad_user_data`, `ad_personalization` | marketing |
| `functionality_storage` | preferences |
| `security_storage` | always `granted` |

`config` waits for analytics consent on purpose: with `loadBeforeConsent`,
gtag.js is on the page but has no `config` yet, so it sends no cookieless pings
before the visitor agrees.

**Names.** `lead` becomes `generate_lead`; any character other than letters,
digits and `_` becomes `_` (`consentlayer.scroll_depth` →
`consentlayer_scroll_depth`).

**Personal data.** `user_id` with analytics. Email and phone (with a leading
`+`) go into `user_data` only with marketing; gtag hashes them itself.

## Meta Pixel

`meta({ pixelId, locale?, loadBeforeConsent? })` from `consentlayer/providers/meta`.

| | |
|---|---|
| Required category | `marketing` |
| Script | `https://connect.facebook.net/<locale>/fbevents.js` (default `en_US`) |
| Loads | on marketing consent; at boot with `loadBeforeConsent: true` |
| On load | an inline stub defines `fbq`, then `fbq('consent', 'grant' or 'revoke')` from the current consent, then `fbq('init', pixelId, advancedMatching)` |
| On each consent change | `fbq('consent', 'grant' or 'revoke')` |
| `page` | `fbq('track', 'PageView', {}, { eventID })` |
| `track` | `fbq('track' or 'trackCustom', name, params, { eventID })` |
| `identify` | nothing (see below) |
| Withdrawal | `fbq('consent', 'revoke')`; no more events |

`consent` is called before `init`, so with `loadBeforeConsent` the pixel starts
revoked and sends nothing until marketing is granted.

**Names.** Standard events map to Meta's (`purchase` → `Purchase`,
`add_to_cart` → `AddToCart`, …, full list in [Events](/guides/events/)); others
go out with `trackCustom` under their own name. `items` becomes `content_ids`,
`contents`, `content_type: 'product'` and `num_items`; `search_term` becomes
`search_string`. `providers.meta` is merged last.

**Personal data.** Advanced matching is passed to `init` only, because that's
the only place Meta accepts it: `em` (email), `ph` (phone digits) and
`external_id` (user ID), from the identity at load time; the pixel hashes them.
Email and phone are there only if marketing was on. If you call `identify`
after the pixel loaded, the pixel doesn't learn it until the next page load
(the server route still sends it, see [Server forwarding](/internals/server/)).

**Withdrawal after matching.** The pixel keeps `init`'s email and phone for the
page's lifetime. So if it was initialised with them and marketing is then
withdrawn, it stays revoked and silent until reload, even if marketing is
granted again.

**Dedupe.** Each `page` and `track` passes `eventID`, the same ID the server
route sends to the Conversions API.

## PostHog

`posthog({ apiKey, apiHost?, cookieless?, autocapture?, recording?, errors?, groupType?, defer? })`
from `consentlayer/providers/posthog`. `posthog-js` is imported dynamically.

| | |
|---|---|
| Required category | `none` with `cookieless` (default); `analytics` with `cookieless: false` |
| Loads | at boot (or `defer`) when cookieless; on analytics consent otherwise |
| `init` options | `api_host` (default `https://us.i.posthog.com`), `cookieless_mode: 'on_reject'` when cookieless, opted out and no persistence by default; autocapture off unless asked; no automatic pageview, pageleave, exceptions, heatmaps, dead clicks, recording, surveys, feature flags or remote dependencies |
| Analytics granted | `opt_in_capturing()`, then `identify(userId)` if there is one, then session recording if `recording: true` (the recorder is imported only then) |
| Analytics withdrawn | `opt_out_capturing()` |
| `page` | `capture('$pageview', { $current_url, title })` |
| `track` | `capture(name, { ...params, ...providers.posthog })` |
| `identify` | `identify(userId, { ...traits, email? })`, only with analytics and a user ID |
| `group` | `group(groupType ?? 'company', id, traits)`, only with analytics |
| `reset` | `reset()`, then re-applies the consent state |
| `error` | `captureException(error, { level, ...tags, ...extra })`, unless `errors: false` |

**Cookieless.** Before analytics consent PostHog is opted out, which in
`on_reject` mode means it counts events without cookies or storage. This
needs cookieless mode turned on in the PostHog project settings. Events sent
before consent are anonymous; nothing about the user is passed until
analytics is granted.

**Names.** Unchanged.

**Personal data.** User ID with analytics; email (as a trait on `identify`)
only with marketing too.

## Sentry

`sentry({ dsn, environment?, release?, replay?, tracing?, defer? })` from
`consentlayer/providers/sentry`. The SDK is imported dynamically.

| | |
|---|---|
| Required category | `none` |
| Loads | at boot (or `defer`) |
| `init` options | `dataCollection` with user info, cookies, headers, bodies and URL query strings all off; Sentry's own `GlobalHandlers` integration removed; transactions dropped while analytics is off |
| Analytics granted | `setUser({ id, email })` if there's a user ID; Replay added (or restarted, buffering for errors); tracing added once |
| Analytics withdrawn | `setUser(null)`; Replay stopped |
| `page`, `track` | nothing |
| `identify` | re-applies `setUser` from the current consent |
| `reset` | `setUser(null)` |
| `error` | `captureException(error, { level, tags: { ...tags, source }, extra })` |

**Errors without consent.** Error reports are treated as needed to run the
site, so they are sent under any consent, with no IP, cookies, headers, bodies
or query strings. Uncaught errors reach Sentry through consentlayer's own
`window` `error` and `unhandledrejection` listeners (that's why Sentry's are
removed, to avoid duplicates), unless `errors: false` or
`errors: { globalHandlers: false }`.

**Replay and tracing** are features of analytics consent. Tracing, once added,
can't be removed, so after a withdrawal its transactions are dropped by
`beforeSendTransaction`. Replay sample rates default to 0.1 for sessions and
1 for errors; tracing to 1. A regrant after a withdrawal only buffers for
errors; full session recording resumes on the next page load.

**Personal data.** User ID with analytics; email with analytics and marketing.

## Contentsquare

`contentsquare({ tagId })` from `consentlayer/providers/contentsquare`.

| | |
|---|---|
| Required category | `analytics` |
| Script | `https://t.contentsquare.net/uxa/<tagId>.js` |
| Loads | on analytics consent (no `loadBeforeConsent`) |
| On load | defines the `window._uxa` command queue; the tag sends the first page view itself |
| `page` | `['trackPageview', path]` without query or hash, skipping the page the tag loaded on |
| `track` | `['trackPageEvent', name]`; params are not sent. `purchase` becomes `['ec:transaction:create', { id: transaction_id, revenue: value, currency }]` and `['ec:transaction:send']` |
| `identify` | `['identify', userId]` when there is a user ID |
| `reset` | `['resetIdentity']` |
| Teardown on analytics withdrawal | `['optout']`: Contentsquare stops collecting, removes its cookies and sets `_cs_optout` |

Contentsquare has no web command to opt back in. When analytics is granted
again, `_cs_optout` is deleted, so collection resumes on the next page load.
See [Contentsquare's consent docs](https://docs.contentsquare.com/en/web/send-the-users-decisions-about-data-collection/).

**Personal data.** User ID with analytics. Email is never sent: Contentsquare
advises against identifying by email.

## Hotjar

Deprecated: Hotjar accounts are moving to Contentsquare, after which the
Hotjar account stops collecting. Switch to [`contentsquare`](#contentsquare)
once yours has moved; `hotjar` is removed in the next major.


`hotjar({ siteId, version, reloadOnRevoke? })` from `consentlayer/providers/hotjar`.

| | |
|---|---|
| Required category | `analytics` |
| Script | `https://static.hotjar.com/c/hotjar-<siteId>.js?sv=<version>` |
| Loads | on analytics consent (no `loadBeforeConsent`) |
| On load | defines a queueing `window.hj` and `window._hjSettings = { hjid, hjsv }` |
| `page` | nothing (Hotjar tracks page views itself) |
| `track` | `hj('event', name)`; params are not sent |
| `identify` | `hj('identify', userId ?? null, { ...traits, email? })` |
| `reset` | `hj('identify', null, {})` |
| Teardown on analytics withdrawal | deletes every `_hj*` cookie on the current host and each parent domain, every `_hj*`/`hj*` key in localStorage and sessionStorage, then reloads the page if `reloadOnRevoke` |

Hotjar has no off switch once loaded: it keeps recording until the page
unloads. Clearing its storage stops it from recognising the visitor later;
`reloadOnRevoke: true` stops the current recording too.

**Personal data.** User ID with analytics; email only when there is also a user
ID and marketing is on.

## Vercel Analytics

`vercel({ trackEvent })` from `consentlayer/providers/vercel`, with `track`
from `@vercel/analytics` as `trackEvent`.

| | |
|---|---|
| Required category | `none` (Vercel Analytics is cookieless) |
| Loads | nothing; you render Vercel's `<Analytics />` yourself, which also counts page views |
| `track` | `trackEvent(name, params)` with params flattened: strings, numbers and booleans kept, `null`/`undefined` become `null`, dates become ISO strings, objects and arrays dropped |
| Everything else | nothing |

**Personal data.** None; identity is never passed.

## TikTok

`tiktok()` from `consentlayer/providers/tiktok`.

| | |
|---|---|
| Required category | `marketing` |
| Loads | nothing; you load the TikTok pixel (`ttq`) yourself |
| On each consent change | `ttq('consent', 'grant')` with marketing, `ttq('consent', 'reject')` without, if `window.ttq` exists |
| Everything else | nothing |

It only forwards consent; send TikTok events yourself through `ttq`.
