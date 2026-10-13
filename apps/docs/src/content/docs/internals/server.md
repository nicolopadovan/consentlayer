---
title: Server forwarding
description: What the browser posts, what the route does with it, and exactly what Meta CAPI and GA4 receive.
sidebar:
  order: 4
---

Setup is in [Server-Side Tracking](/guides/server-side-tracking/). This page
follows one event from the browser to the vendor.

## When the browser posts

With `createAnalytics({ server: { endpoint: '/api/analytics' } })`, every
`page()` and `track()` call is also sent to that endpoint. The endpoint must
be a relative path or an `https://` URL.

An event is posted when all of these hold:

- the instance has booted (earlier calls are queued, up to 100, and posted at boot);
- analytics **or** marketing is granted (the route decides per destination
  which one it needs);
- for `track`, the event's own `requireAnalyticsConsent` /
  `requireMarketingConsent` is met. This includes auto-tracked events (page
  sessions, scroll depth, time on page, clicks).

It is posted once per call, before the browser providers run, whether or not
any browser provider is active.

The request is `fetch(endpoint, { method: 'POST', keepalive: true })` with
`content-type: application/json`. `keepalive` lets it finish when the visitor
navigates away. Without `fetch`, `navigator.sendBeacon` is used instead. A
network error or non-2xx response is reported to `onError` with
`scope: 'server-forward'` and the message `Sending <name> to <endpoint> failed`.

### The body

For `track('add_to_cart', params, options)`:

```json
{
  "id": "6f1c2a9e-…",
  "name": "add_to_cart",
  "params": { "value": 25, "currency": "EUR", "items": [] },
  "url": "https://shop.example/products/mug",
  "only": ["meta"],
  "providers": { "meta": { "content_category": "mugs" } },
  "consent": { "preferences": false, "analytics": true, "marketing": true },
  "identity": { "userId": "u_42", "email": "ada@example.com", "phone": "+393401234567" }
}
```

For `page()`: `id`, `name: "page_view"`, `url`, `only` (if passed), `consent`
and `identity`; no `params`.

| Field | From |
|---|---|
| `id` | `options.eventId`, or a new `crypto.randomUUID()` |
| `url` | `location.href` at send time (for `page`, the page's `url`) |
| `only`, `providers` | the call's options, omitted when not set |
| `consent` | the current consent |
| `identity` | `{}`, `{ userId }`, or with marketing also `email` and `phone` (see [Consent](/internals/consent/#identity-storage)) |

The browser never sends `clientId`; the route reads GA4's cookie instead.

## The route

`createAnalyticsHandler({ destinations, onError })` returns a
`(request: Request) => Promise<Response>`. It runs these steps in order and
stops at the first failure:

1. **Origin check.** Takes the `Origin` header, or the origin of `Referer` if
   there's no `Origin`, and requires it to equal the request URL's origin. A
   missing header is refused too, so other sites and plain `curl` calls can't
   post events.
2. **Body.** `content-type` must contain `application/json`. The body is read
   as a stream and refused as soon as it passes 16 KB, then parsed as JSON.
3. **Validation.**
   - `name`: 1–100 characters from letters, digits, `_`, `.`, `:` and `-`.
   - `consent`: `preferences`, `analytics` and `marketing` must all be booleans.
   - `id`, `url`, `clientId`: strings if present.
   - `params`, `providers`: objects if present.
   - `only`: an array of strings if present.
   - `identity`: an object whose values are all strings if present.
4. **Destinations.** Only destinations with `forwardBrowserEvents: true`. Of
   the built-in ones, that's `metaCapi`.
5. **Consent filter.** A destination gets the event only if
   `consent[requiredConsent] === true` and, when `only` is set, its `id` is in
   `only`.
6. **Request info.** Client IP (first `x-forwarded-for` entry, else
   `x-real-ip`), `user-agent`, and the parsed `cookie` header.
7. **Send.** All remaining destinations in parallel
   (`Promise.allSettled`), so one failing vendor doesn't stop the others.
8. **Answer.** `204` once all sends have settled. Each failed send is passed to
   `onError`; the browser isn't told.

The IP header is trusted as-is. Hosts like Vercel overwrite `x-forwarded-for`
themselves; behind a proxy that doesn't, a client could set it.

The consent in the body comes from the browser. The route can't verify it; it
only makes sure each vendor gets events the visitor's browser says it may.

`sendServerEvent(event, { destinations, request })` is steps 5 and 7 on their
own, for webhooks and other server-only events: you build the event (including
`consent`) yourself, and it returns `{ id, ok, error? }` per destination
instead of calling `onError`.

## Shared event IDs and Meta dedupe

The browser pixel and the server post use the same `id`:

- `page()` creates one ID, passes it to the pixel as
  `fbq('track', 'PageView', {}, { eventID })`, and posts it as `id`.
- `track()` does the same with `fbq('track' | 'trackCustom', …, { eventID })`.

`metaCapi` sends that `id` as `event_id`, and the same event name the pixel
used (`page_view` is translated to `PageView` too). Meta sees two copies of
the event with the same name and ID and keeps one. When the pixel is blocked,
the server copy still arrives.

If you send a server-only event for something that also happened in the
browser (for example a purchase confirmed by a webhook), pass the browser's
event ID through, via `track(name, params, { eventId })` in the browser and
`id` on the server.

## What `metaCapi` sends

`POST https://graph.facebook.com/<apiVersion ?? 'v26.0'>/<pixelId>/events?access_token=…[&test_event_code=…]`

```json
{
  "data": [{
    "event_name": "AddToCart",
    "event_time": 1760353200,
    "event_id": "6f1c2a9e-…",
    "event_source_url": "https://shop.example/products/mug",
    "action_source": "website",
    "custom_data": { "value": 25, "currency": "EUR", "content_ids": ["…"], "content_category": "mugs" },
    "user_data": {
      "client_ip_address": "203.0.113.7",
      "client_user_agent": "Mozilla/5.0 …",
      "fbp": "fb.1.1760000000000.123456789",
      "fbc": "fb.1.1760000000000.AbCdEf",
      "em": "<sha256>",
      "ph": "<sha256>",
      "external_id": "<sha256>"
    }
  }]
}
```

| Field | Source |
|---|---|
| `event_name`, `custom_data` | the same translation as the pixel (`toMetaEvent`, see [Events](/guides/events/)), then `providers.meta` merged in; values that aren't plain (a `Date`, a class instance) are dropped |
| `event_time` | server clock, in seconds |
| `fbp`, `fbc` | the `_fbp` and `_fbc` cookies the pixel set, if any |
| `em` | email trimmed and lowercased; sent only if valid |
| `ph` | phone reduced to digits; sent only if it is valid E.164; hashed without the `+` |
| `external_id` | the user ID, hashed as-is |

The route only gets here with marketing granted, which is also when the
browser includes email and phone. Fields that end up `undefined` are left out
of the JSON. A non-2xx answer throws `Meta CAPI <status>: <response body>`.

## What `ga4Server` sends

`POST https://www.google-analytics.com/mp/collect?measurement_id=…&api_secret=…`

```json
{
  "client_id": "111.222",
  "user_id": "u_42",
  "user_data": { "sha256_email_address": "<sha256>", "sha256_phone_number": "<sha256>" },
  "consent": { "ad_user_data": "GRANTED", "ad_personalization": "GRANTED" },
  "events": [{ "name": "purchase", "params": { "value": 25, "currency": "EUR" } }]
}
```

| Field | Source |
|---|---|
| `client_id` | `event.clientId`, else the `_ga` cookie: `GA1.1.111.222` → `111.222` |
| `user_id` | `identity.userId`, not hashed |
| `user_data` | only with marketing: email trimmed and lowercased; phone reduced to digits with a leading `+`; each sent only if valid (the same checks as Meta) and hashed with the `+`, as Google asks; left out when empty |
| `consent` | both `GRANTED` with marketing, else `DENIED` |
| `events[0].name` | `ga4EventName` (same rule as gtag: `lead` → `generate_lead`, other characters → `_`) |
| `events[0].params` | `params`, then `providers.ga4` merged in |

Requires analytics consent. With no client ID it throws
`ga4Server needs event.clientId or the _ga cookie`, because GA4 can't tie the
event to a visitor without one. A non-2xx answer throws
`GA4 Measurement Protocol <status>: <response body>`.

### Why `ga4Server` is server-only

`ga4Server` has `forwardBrowserEvents: false`, so `createAnalyticsHandler`
never sends to it, and its type doesn't let you pass it there. GA4 has no
event-ID dedupe: forwarding every browser event would count each one twice.
Google's Measurement Protocol is meant to add events gtag can't see (refunds,
subscription renewals, webhooks), so use it through `sendServerEvent`.

## Hashing

Both destinations hash with SHA-256 through WebCrypto (`crypto.subtle.digest`),
which Node and edge runtimes both provide, and send it as lowercase hex.
Empty values are not hashed and not sent.

## Status codes

| Status | When |
|---|---|
| `204` | accepted; sent to every destination consent allows (failures go to `onError`) |
| `400` | empty body, invalid JSON, or the event failed validation |
| `403` | `Origin`/`Referer` from another origin, neither header present, or a malformed `Referer` |
| `413` | body larger than 16 KB |
| `415` | `content-type` isn't JSON |
| `500` | anything unexpected; the error goes to `onError` |
