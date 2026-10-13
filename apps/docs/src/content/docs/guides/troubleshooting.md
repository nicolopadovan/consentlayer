---
title: Troubleshooting
description: Symptoms, causes and fixes for ConsentLayer, with the exact messages it reports.
---

Each section starts from a symptom, lists its causes and gives the fix. Error
messages are quoted as ConsentLayer reports them. Start by turning on
diagnostics, which reports most of the problems below.

## Turn on diagnostics

Pass `debug: true` and an `onError` handler:

```ts title="lib/analytics.ts"
export const analytics = createAnalytics({
  providers,
  debug: process.env.NODE_ENV !== 'production',
  onError: (error) => console.error(error.scope, error.message, error.cause),
})
```

`debug` logs every consent change and every error to the browser console with
`console.debug`, prefixed with `[consentlayer]`:

```text
[consentlayer] consent updated imperative {preferences: false, analytics: true, marketing: false}
[consentlayer] [provider-script-load] Failed to load GA4 gtag.js for measurement ID G-ABC123
```

Browsers hide `console.debug` output by default. In Chrome, select
**Verbose** in the console's log levels; in Firefox and Safari, enable
**Debug**.

`onError` receives every error ConsentLayer catches. A failing provider never
throws into your code, so without `onError` or `debug` its errors are silent.
Each error has a `scope`, a `message`, the `providerId` when one provider
caused it, and the original error as `cause`.

### Error scopes

| Scope | Raised when |
|---|---|
| `provider-setup` | A plugin's `setup` hook threw, or two plugins use the same `id` |
| `provider-load` | A plugin's `load` hook threw |
| `provider-script-load` | A provider's script failed to download |
| `provider-consent` | A plugin's `consent` hook threw |
| `provider-page`, `provider-track` | A plugin's `page` or `track` hook threw |
| `provider-identify` | A plugin's `identify`, `reset` or `group` hook threw |
| `provider-error` | A plugin's `error` hook threw while reporting an error |
| `provider-teardown` | A plugin's `teardown` hook threw on withdrawal |
| `consent-adapter` | A consent adapter, or the `server.consentEndpoint` request, failed |
| `server-forward` | Forwarding an event to `server.endpoint` failed |
| `queue-full` | More than 100 calls were waiting, and later ones were dropped |

A hook failure has the message `` `<provider id>.<hook> failed` ``, for example
`ga4.load failed`, with the thrown error as `cause`.

## `createAnalytics()` or a provider throws at startup

The configuration is validated when the instance or the provider is created,
so an invalid value fails at import time rather than silently sending nothing.

| Message | Cause and fix |
|---|---|
| `[consentlayer] Invalid GA4 measurement ID: expected format "G-XXXXXXXX", received ...` | `ga4({ measurementId })` must be `G-` followed by 4 to 16 uppercase letters or digits. A missing or empty value does not throw: the provider is turned off, and `debug: true` logs `ga4 is off: measurementId is not set.` |
| `[consentlayer] Invalid Meta Pixel ID: expected 8-20 digit numeric string, received ...` | `meta({ pixelId })` must be the numeric pixel ID, not the dataset name |
| `[consentlayer] server.endpoint must be an HTTPS URL or a relative path starting with "/", received ...` | Use a relative path such as `/api/analytics`, or an `https://` URL |
| `[consentlayer] server.consentEndpoint must be an HTTPS URL or a relative path starting with "/", received ...` | The same rule applies to the consent records endpoint |

In Next.js, only variables prefixed with `NEXT_PUBLIC_` reach the browser
bundle. A measurement ID read from `process.env.GA4_ID` in client code is
`undefined`, which `ga4()` reports as above.

## A hook throws outside the provider

```text
useAnalytics needs createAnalytics() to have run, or an AnalyticsProvider above it
```

`useAnalytics()` and `useConsent()` use the instance from the nearest
`<AnalyticsProvider>`, or else the one `createAnalytics()` created. This error
means neither exists when the component renders: the module that calls
`createAnalytics()` has not been imported yet. Import it from your root layout
or providers file, or render the component inside `<AnalyticsProvider>`.

```text
useConsentController must be used within AnalyticsProvider
```

`useConsentController()` holds the banner's state in `<AnalyticsProvider>`, so
it has no fallback. Render the banner inside the provider. In the Next.js App
Router, the provider and the banner must both be inside a `'use client'`
boundary; see [Next.js](/start/nextjs/).

## A provider never loads

The provider's script is missing from the Network panel, or tools such as
Meta Pixel Helper and Google Tag Assistant find nothing.

**The visitor has not granted the required consent.** Providers load only
after the category they need is granted: analytics for GA4, Hotjar and PostHog;
marketing for Meta; and the category set by `requiredConsent` for your own
plugins. Before consent, the script is not requested at all. Accept the banner
or call `analytics.consent.update({ analytics: true })`, then check again.
`loadBeforeConsent: true` on `ga4()` or `meta()` only downloads the script at
boot; GA4 still sends nothing, and the Meta Pixel stays revoked, until consent
is granted.

**The instance has not booted.** `<AnalyticsProvider>` boots on mount by
default. With `boot={{ mode: 'manual' }}`, nothing loads until you call
`analytics.boot()`. With any other `mode`, boot waits for the browser to be
idle, up to `timeoutMs` (3000 ms with `requestIdleCallback`, 1500 ms without).
Without `<AnalyticsProvider>`, call `analytics.consent.bootstrap()` and then
`analytics.boot()` yourself.

**Loading is deferred.** A provider created with `defer` waits for the
browser to be idle (`'idle'`), for the first click, key press or scroll
(`'interaction'`), or for the given number of milliseconds.

**`enabled` is false.** `createAnalytics({ enabled: false })`, or a function
that returns `false`, turns every provider off.

**The browser blocked the script.** A Content Security Policy without the
provider's domains, or an ad blocker, stops the download. ConsentLayer reports
it under `provider-script-load`:

```text
Failed to load GA4 gtag.js for measurement ID G-ABC123
Failed to load Meta Pixel (fbevents.js)
```

Add the domains listed in
[Content Security Policy](/start/installation/#content-security-policy).
Ad blockers cannot be worked around from the browser; send the events that
matter through [server-side tracking](/guides/server-side-tracking/).

<details>
<summary>Meta stays off after consent is withdrawn and granted again</summary>

When marketing consent is withdrawn, the Meta Pixel is revoked. If the pixel
was started with the visitor's email or phone, it stays off until the next
page load, even if consent is granted again, because the pixel keeps the
email and phone passed to its `init` call. A reload starts it again.

</details>

## An event does not reach a provider

**The provider is not active.** `track()`, `page()`, `identify()` and
`group()` are delivered only to providers whose consent is granted. Events
sent before consent are not replayed to a provider that loads later.

**The event is limited to other providers.** `{ only: ['ga4'] }` on a call, or
`autoTracking: { only: [...] }`, sends it only to the listed provider IDs.

**The event is waiting for boot.** Calls made before `boot()` are held and
delivered once it runs. After 100 waiting calls, later ones are dropped:

```text
100 calls are already waiting for boot; later ones are dropped
100 calls are already waiting for meta to load; later ones are dropped
```

The first message means `boot()` never ran; see
[A provider never loads](#a-provider-never-loads). The second means a
provider's `load` has not finished, usually because its script is blocked.

**Two plugins share an ID.** The second one is ignored:

```text
Another provider already uses the id "ga4"; this one is ignored
```

Give each instance of a custom plugin its own `id`.

**GA4 renamed the event.** GA4 accepts only letters, digits and underscores in
event names, so the GA4 provider replaces every other character with `_`:
`checkout.step` arrives as `checkout_step`. `lead` is sent as `generate_lead`.

## The banner appears on every visit

**The storage names changed.** Consent is stored in local storage under
`consentlayer_consent`, or `<prefix>_consent` with `names.prefix`. Changing the
prefix, or upgrading from `@nicolopadovan/analytics-consent-manager` without
`names: { legacy: true }`, makes stored consent unreadable, so every visitor
sees the banner again. See [Names](/guides/names/) and
[Upgrading to 1.0](/guides/migrating-to-v1/#keep-stored-consent).

**Two instances use different names.** Each call to `createAnalytics()` sets
the page's names, so the last one wins. When the names differ, it warns:

```text
[consentlayer] createAnalytics() was called again with different names. Storage keys, globals and events are per page, so the last names win: create one instance per page.
```

Create the instance once in a module and import it everywhere, rather than
calling `createAnalytics()` inside a component.

**Local storage is unavailable.** Some private browsing modes and sandboxed
iframes block it. The default storage does not throw, but the choice cannot be
saved, so the banner returns on the next page load. To keep consent elsewhere,
such as a cookie, pass your own adapter as
`createAnalytics({ consent: { storage } })`. If that adapter throws while
reading, `useConsentController().error` holds the reason and the banner is
shown.

**The banner flashes for returning visitors.** Render nothing until
`useConsentController().ready` is `true`, as the
[Consent UI recipe](/guides/consent-ui/) does.

## `setConsent()` rejects with a TypeError

```text
TypeError: [consentlayer] consent must have boolean preferences, analytics and marketing, received {"preferences":true,"analytics":"false","marketing":false}.
```

`setConsent()` accepts only booleans, so a string such as `'false'` is never
mistaken for a grant. Custom categories are added to the list in the message.
Convert values read from a cookie, form or query string before passing them:

```ts
await analytics.consent.setConsent({
  preferences: form.preferences === 'on',
  analytics: form.analytics === 'on',
  marketing: form.marketing === 'on',
})
```

To change some categories and keep the others, use
`analytics.consent.update({ marketing: true })`.

## Server-side events don't arrive

Check the browser first. The browser forwards an event to `server.endpoint`
only while analytics or marketing consent is granted. A forwarding failure is
reported under `server-forward`:

```text
Sending purchase to /api/analytics failed
```

Its `cause` is `HTTP <status>` when the route answered with an error status.
The route answers with an empty body, so the status code is the only clue:

| Status | Cause and fix |
|---|---|
| 403 | The `Origin` header is missing, or neither `Origin` nor `Referer` matches the origin of the request URL. Behind a proxy that rewrites the host or protocol, the request URL the route sees must keep the public origin |
| 415 | The request's `Content-Type` is not `application/json` |
| 400 | The body is empty, is not valid JSON, or is not an event: `name` must match `/^[\w.:-]{1,100}$/` and `consent` must have boolean `preferences`, `analytics` and `marketing` |
| 413 | The body is larger than 16 KB |
| 500 | The route threw; the error is passed to the handler's `onError` |
| 204 | The route accepted the event. A vendor that rejected it is reported to `onError`, not in the status |

A 204 does not mean the vendor received the event. Pass `onError` to
`createAnalyticsHandler()` and check your server logs:

```text
Meta CAPI 400: {"error":{"message":"Invalid OAuth access token...", ...}}
GA4 Measurement Protocol 400: ...
ga4Server needs event.clientId or the _ga cookie
```

**Meta receives nothing despite a 204.** `metaCapi()` sends only events whose
consent includes marketing. With `consentCookie`, the route ignores the
consent in the body and reads the signed cookie instead; when the cookie is
missing or invalid, every category counts as denied and the route still
answers 204. Check that the consent records endpoint has set the
`consentlayer_proof` cookie on the same site.

**Events arrive but aren't attributed.** Use Meta's **Test events** tool with
`metaCapi({ testEventCode })` to see what Meta receives. Pixel and server
events with the same event ID are deduplicated, so a server event that seems
missing may have been merged with its pixel event.

## Consent records fail

```text
[consentlayer] the consent secret needs at least 32 characters
```

`createConsentHandler()` signs the consent cookie with HMAC-SHA-256 and
rejects short secrets. Generate one with `openssl rand -base64 32`.

A 400 from the consent endpoint means the browser sent consent without boolean
categories. A store error, such as `[consentlayer] supabase insert failed`,
becomes a 500 and is passed to the handler's `onError`. In the browser, a
failed request is reported under `consent-adapter`:

```text
Consent adapter "consent-endpoint" failed to apply consent
```

The visitor's choice is still saved locally, so the banner does not reappear.
See [Consent records](/guides/consent-records/).

## TypeScript cannot find a `consentlayer/*` module

```text
TS2307: Cannot find module 'consentlayer/react' or its corresponding type declarations.
```

ConsentLayer declares its entry points with package `exports`, which
TypeScript reads only with `moduleResolution` set to `bundler`, `node16` or
`nodenext`. See [TypeScript](/start/installation/#typescript).
