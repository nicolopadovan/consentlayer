---
title: Server forwarding
description: What the browser posts, how the route validates and filters it, and exactly what Meta CAPI, the TikTok Events API, server-side GTM and GA4 receive.
sidebar:
  order: 4
---

This page follows one event from the browser to a vendor's server API: when
the browser posts it, how `createAnalyticsHandler` validates and filters it,
and the exact request each built-in destination sends. Setup is covered in
[Server-side tracking](/guides/server-side-tracking/). The browser side lives
in `src/core/analytics-manager.ts` and the server side in `src/server/`.

## When the browser posts

With `createAnalytics({ server: { endpoint: '/api/analytics' } })`, every
`page()` and `track()` call is also sent to that endpoint. The endpoint must
be an `https:` URL or a path starting with a single `/`; `undefined` or `''`
turns forwarding off, and anything else throws when the instance is created.

An event is posted when all of the following hold at delivery time:

1. The instance has booted. Earlier calls wait in the pre-boot queue (up to 100) and are posted as it drains.
2. Analytics or marketing consent is granted. The route decides per
   destination which category it needs.
3. For `track`, the call's own `requireAnalyticsConsent` and
   `requireMarketingConsent` are met. This includes auto-tracked events, which
   always require analytics consent.

The post happens once per call, before any browser provider runs, and whether
or not any browser provider is active. It is not awaited.

The request is `fetch(endpoint, { method: 'POST', keepalive: true })` with
`content-type: application/json`; `keepalive` lets it complete when the
visitor navigates away. Where `fetch` is unavailable,
`navigator.sendBeacon` sends the same body as an `application/json` blob. A
network error, a non-2xx response or a refused beacon is reported to
`onError` with scope `server-forward` and the message
`Sending <name> to <endpoint> failed`.

A response carrying the header `consentlayer-forwarding: off` stops
forwarding until the page is reloaded. The route sends it when it has no
destination, so the browser stops posting events that would be dropped.
Events already in flight still complete. `sendBeacon` cannot read the
response, so without `fetch` the browser keeps posting.

A response carrying `consentlayer-events` lists, comma-separated, the event
names the route's destinations take. From then on, the browser posts only
those events and events whose `only` is set, until the page is reloaded. The
route omits the header when a destination takes every event; an empty value
means none.

A response carrying `consentlayer-consent: missing` means the route found no
valid consent cookie. With `server.consentEndpoint` set, the browser posts
`{ consent, restored: true }` there, once per page load, and the consent route
answers with a new cookie. A failure is reported with scope `server-forward`
and the message `Restoring the consent cookie at <consentEndpoint> failed`.

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

For `page()`, the body has `id`, `name: "page_view"`, `url`, `only` (if
passed and `server` is not `true`), `categories` (if `server` is an array),
`consent` and `identity`, and no `params` or `providers`. Automatic page views
are forwarded once per route without `only`. When the visitor grants analytics
or marketing later on the same route, the page view is forwarded again with
`categories` set to the newly granted ones, so only the destinations that
require them receive it, under the same `id` as the browser providers that
the grant activates.

| Field               | Source                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                | The event ID shared with browser providers: `options.eventId`, or a new `crypto.randomUUID()`                                  |
| `url`               | `location.href` at send time; for `page`, the page's `url`                                                                     |
| `only`, `providers` | The call's options; omitted when not set                                                                                       |
| `categories`        | `page()`'s `server` option when it is an array; omitted otherwise                                                              |
| `consent`           | The current consent, including custom categories and `sale_of_data` when set                                                   |
| `identity`          | `{}`, `{ userId }`, or, with marketing consent, also `email` and `phone` (see [Consent](/internals/consent/#identity-storage)) |

The browser never sends `clientId`. The route reads GA4's `_ga` cookie
instead.

## The route

`createAnalyticsHandler({ destinations, consentCookie?, onError? })` from
`consentlayer/server` returns a web-standard
`(request: Request) => Promise<Response>`. For each request, it runs these
steps in order and stops at the first failure. With `consentCookie`, a secret
under 32 characters fails before step 1 with a `500`. An unset secret does
not fail: the handler logs
`[consentlayer] consentCookie.secret is not set: every event is treated as denied.`
once when created, and every event counts as denied, so nothing is sent:

1. **Origin check.** Takes the `Origin` header, or the origin of the
   `Referer` header when `Origin` is absent, and requires it to equal the
   origin of the request URL. A request with neither header is refused, so
   other sites and plain `curl` calls cannot post events.
   When no destination is left after step 6's filter, the handler answers
   `204` with `consentlayer-forwarding: off` right after this check, without
   reading the body.
2. **Content type.** `content-type` must contain `application/json`.
3. **Body.** The body is read as a stream and refused as soon as it exceeds
   16 KB, then parsed as JSON.
4. **Validation.**
   - `name`: 1 to 100 characters from letters, digits, `_`, `.`, `:` and `-`.
   - `consent`: an object whose `preferences`, `analytics` and `marketing`
     are booleans.
   - `id`, `url`, `clientId`: strings if present.
   - `params`, `providers`: plain objects (not arrays) if present.
   - `only`: an array of strings if present.
   - `identity`: an object whose values are all strings if present.
5. **Consent source.** With `consentCookie`, the body's `consent` is
   replaced by the consent in the signed cookie that `createConsentHandler`
   set. A missing or invalid cookie means every category is denied, and the
   response carries `consentlayer-consent: missing`.
6. **Destinations.** `undefined` entries, such as a `metaCapi()` called
   without its token, are dropped. Only destinations with
   `forwardBrowserEvents: true` are considered. Of the built-in ones, those
   are `metaCapi`, `tiktokEvents` and `sgtm`.
7. **Consent, `only` and `events` filter.** A destination receives the event
   only if `consent[destination.requiredConsent] === true`; when `only` is
   set, its `id` is in `only`; and its `events` option, when set, lists the
   event's name, `page_view` included, unless `only` names the destination.
8. **Request info.** `requestInfo(request)`: the client IP (the first
   `x-forwarded-for` entry, else `x-real-ip`), `user-agent`, and the parsed
   `cookie` header.
9. **Send.** All remaining destinations in parallel with
   `Promise.allSettled`, so one failing vendor does not stop the others.
10. **Response.** `204` once every send has settled, with the
    `consentlayer-events` header unless a destination takes every event.
    Each failed send is passed to `onError`; the browser is not told.

<details>
<summary>Trust model</summary>

The IP header is trusted as received. Hosts such as Vercel overwrite
`x-forwarded-for` themselves; behind a proxy that does not, a client can set
it.

Without `consentCookie`, the consent in the body comes from the browser and
the route cannot verify it: the route only guarantees that each destination
receives the events the visitor's browser says it may. With
`consentCookie`, consent comes from an HMAC-SHA-256 signed cookie your server
issued when it recorded the choice, and the body's consent is ignored. See
[Consent records](/guides/consent-records/).

The origin check prevents cross-site posts from browsers, which always send
`Origin` or `Referer` on a cross-origin `fetch`. It is not authentication: a
non-browser client can forge both headers.

</details>

`sendServerEvent(event, { destinations, request? })` drops `undefined`
destinations and runs steps 7 and 9 on their own, for webhooks and other events that originate on the server. You
build the event, including `consent`, yourself. It returns one
`{ id, ok, error? }` per destination that passed the filter instead of
calling `onError`.

<details>
<summary>The destination contract</summary>

A destination is a plain object. `send` must throw or reject when the vendor
refuses the event; that is how failures reach `onError` or the
`ok: false` result.

```ts
interface ServerDestination<Forward extends boolean = boolean> {
  id: string
  requiredConsent: keyof ConsentState
  /** Whether createAnalyticsHandler may send browser events to it. */
  forwardBrowserEvents: Forward
  send(event: ServerEvent, request?: ServerRequestInfo): Promise<void>
}

type ServerRequestInfo = {
  ip?: string
  userAgent?: string
  cookies: Record<string, string>
}
```

`createAnalyticsHandler` is typed to accept only
`ServerDestination<true>[]`, so a destination declared with
`forwardBrowserEvents: false` is a type error there.

</details>

## Shared event IDs and deduplication

The browser pixel and the server post carry the same ID:

- `page()` creates one ID, passes it to the pixel as
  `fbq('track', 'PageView', {}, { eventID })`, and posts it as `id`.
- `track()` does the same with `fbq('track' | 'trackCustom', …, { eventID })`.

`metaCapi` sends that `id` as `event_id`, with the same event name the pixel
used; `page_view` is translated to `PageView` as well. Meta receives two
copies with the same name and ID and keeps one. When the pixel is blocked,
the server copy still arrives.

`tiktokEvents` sends the `id` of each `track()` event as `event_id`, with the
same event name `ttq.track()` used. TikTok deduplicates events with the same
pixel ID, event name and `event_id`. `ttq.page()` takes no event ID, so
`tiktokEvents` skips `page_view`: TikTok receives page views from the pixel
only.

To send a server-only event for something that also happened in the
browser, such as a purchase confirmed by a webhook, generate the ID in the
browser, pass it with `track(name, params, { eventId })`, and use it as `id`
on the server.

## What `metaCapi` sends

`metaCapi({ pixelId, accessToken, testEventCode?, apiVersion?, events?, fetchImpl? })`
from `consentlayer/server/meta` returns `undefined` while `pixelId` or
`accessToken` is unset or empty, and calls `console.warn` once when only one
of them is set. Otherwise the destination has the ID `meta`,
requires marketing consent and accepts browser events. It sends:

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

| Field                                    | Source                                                                                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_name`, `custom_data`              | The same translation as the pixel (`toMetaEvent`, see [Events](/guides/events/)), with `providers.meta` merged in. Values other than strings, numbers, booleans, `null`, arrays and plain objects, such as a `Date` or a class instance, are dropped. |
| `event_time`                             | The server clock, in seconds                                                                                                                                                                                                                          |
| `event_id`, `event_source_url`           | The event's `id` and `url`                                                                                                                                                                                                                            |
| `client_ip_address`, `client_user_agent` | The request info from step 8                                                                                                                                                                                                                          |
| `fbp`, `fbc`                             | The `_fbp` and `_fbc` cookies set by the pixel, if present                                                                                                                                                                                            |
| `em`                                     | The email, trimmed and lowercased; sent only if valid                                                                                                                                                                                                 |
| `ph`                                     | The phone reduced to digits; sent only if it is a valid E.164 number; hashed without the `+`                                                                                                                                                          |
| `external_id`                            | The user ID, hashed as is                                                                                                                                                                                                                             |

Through the route, the event only reaches `metaCapi` with marketing consent,
which is also when the browser includes email and phone. Fields that end up
`undefined` are omitted from the JSON. A non-2xx response throws
`Meta CAPI <status>: <response body>`.

## What `tiktokEvents` sends

`tiktokEvents({ pixelId, accessToken, testEventCode?, events?, fetchImpl? })` from
`consentlayer/server/tiktok` returns `undefined` while `pixelId` or
`accessToken` is unset or empty, and calls `console.warn` once when only one
of them is set. Otherwise the destination has the ID `tiktok`, requires
marketing consent and accepts browser events. A `page_view` is skipped; every
other event is sent as:

`POST https://business-api.tiktok.com/open_api/v1.3/event/track/` with the
headers `Access-Token: <accessToken>` and `Content-Type: application/json`

```json
{
  "event_source": "web",
  "event_source_id": "<pixelId>",
  "test_event_code": "<testEventCode>",
  "data": [{
    "event": "AddToCart",
    "event_time": 1760353200,
    "event_id": "6f1c2a9e-…",
    "user": {
      "email": "<sha256>",
      "phone": "<sha256>",
      "external_id": "<sha256>",
      "ip": "203.0.113.7",
      "user_agent": "Mozilla/5.0 …",
      "ttp": "…",
      "ttclid": "…"
    },
    "properties": { "value": 25, "currency": "EUR", "content_ids": ["…"], "content_type": "product" },
    "page": { "url": "https://shop.example/products/mug" }
  }]
}
```

| Field                  | Source                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `event`, `properties`  | The same translation as the pixel (`toTikTokEvent`, see [Events](/guides/events/)), with `providers.tiktok` merged in                 |
| `event_time`           | The server clock, in seconds                                                                                                          |
| `event_id`, `page.url` | The event's `id` and `url`                                                                                                            |
| `ip`, `user_agent`     | The request info from step 8                                                                                                          |
| `ttp`, `ttclid`        | The `_ttp` and `ttclid` cookies, if present                                                                                           |
| `email`                | The email, trimmed and lowercased; sent only if valid                                                                                 |
| `phone`                | The phone reduced to digits with a leading `+`; sent only if it is a valid E.164 number; hashed including the `+`, as TikTok requires |
| `external_id`          | The user ID, hashed as is                                                                                                             |

Fields that end up `undefined` are omitted from the JSON. TikTok answers
HTTP 200 with `{ code, message, request_id, data }`, and `code` is `0` on
success. A non-2xx response or a non-zero `code` throws
`TikTok Events API <status or code>: <message>`.

## What `ga4Server` sends

`ga4Server({ measurementId, apiSecret, fetchImpl? })` from
`consentlayer/server/ga4` returns `undefined` while `measurementId` or
`apiSecret` is unset or empty, with the same warning when only one is set.
Otherwise the destination has the ID `ga4` and
requires analytics consent. It sends:

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

| Field              | Source                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client_id`        | `event.clientId`, else the last two segments of the `_ga` cookie: `GA1.1.111.222` → `111.222`                                                                                                                                                                                                                          |
| `user_id`          | `identity.userId`, not hashed                                                                                                                                                                                                                                                                                          |
| `user_data`        | Only with marketing consent. The email trimmed and lowercased, with dots before the `@` removed for `gmail.com` and `googlemail.com`; the phone reduced to digits with a leading `+`. Each is sent only if valid, using the same checks as Meta, and hashed including the `+`, as Google requires. Omitted when empty. |
| `consent`          | Both keys `GRANTED` with marketing consent, otherwise `DENIED`                                                                                                                                                                                                                                                         |
| `events[0].name`   | `ga4EventName(name)`, the same rule as gtag: `lead` → `generate_lead`, other invalid characters → `_`                                                                                                                                                                                                                  |
| `events[0].params` | `page_location` from the event's `url` when set, then `params`, then `providers.ga4`; a later key replaces an earlier one                                                                                                                                                                                              |

Without a client ID it throws `ga4Server needs event.clientId or the _ga cookie`,
because GA4 cannot attribute the event to a visitor. A non-2xx response throws
`GA4 Measurement Protocol <status>: <response body>`.

### Why `ga4Server` is server-only

`ga4Server` has `forwardBrowserEvents: false`, so `createAnalyticsHandler`
never sends to it, and its type does not allow passing it there. GA4 has no
event-ID deduplication, so forwarding every browser event would count each
one twice. The Measurement Protocol is meant to add events gtag cannot see,
such as refunds, subscription renewals and webhooks; send those through
`sendServerEvent`.

## What `sgtm` sends

`sgtm({ url, measurementId, apiSecret?, fetchImpl? })` from
`consentlayer/server/sgtm` returns `undefined` while `url` or `measurementId`
is unset or empty, and calls `console.warn` once when only one of them is
set. It throws when `url` is not an HTTPS URL: a path such as `/mp/collect`
is refused, because the request goes to your tagging server. Otherwise the
destination has the ID `sgtm`, requires analytics consent and accepts browser
events.

It sends the same body as `ga4Server`, described above, to the Measurement
Protocol client of your server container:

`POST <url>?measurement_id=…[&api_secret=…]`

The `url` is the client's endpoint, such as
`https://sgtm.example.com/mp/collect`. `measurement_id` is always set to
`measurementId`, and `api_secret` is added only when you pass `apiSecret`, for
a client or tag that checks it. Both replace a query parameter of the same
name in `url`.

Without a client ID it throws `sgtm needs event.clientId or the _ga cookie`.
A non-2xx response throws `Server-side GTM <status>: <response body>`.

## Hashing

`metaCapi` and `tiktokEvents` hash the email, the phone number and the user
ID, and `ga4Server` and `sgtm` hash the email and the phone number and send
`user_id` as is. All of them use SHA-256 through Web Crypto
(`crypto.subtle.digest`), which Node.js and edge runtimes both provide, and
send the digest as lowercase hex. Empty values are neither hashed nor sent.

## Status codes

| Status | When                                                                                                                                                                                                                                                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `204`  | Accepted; sent to every destination consent allows. Failures go to `onError`. With `consentlayer-forwarding: off` when there is no destination, `consentlayer-events` listing the event names the destinations take unless one takes every event, and `consentlayer-consent: missing` when `consentCookie` is set and no valid cookie was sent. |
| `400`  | No body, invalid JSON, or the event failed validation                                                                                                                                                                                                                                                                                           |
| `403`  | `Origin` or `Referer` from another origin, neither header present, or a malformed `Referer`                                                                                                                                                                                                                                                     |
| `413`  | Body larger than 16 KB                                                                                                                                                                                                                                                                                                                          |
| `415`  | `content-type` does not contain `application/json`                                                                                                                                                                                                                                                                                              |
| `500`  | Any other error; it is passed to `onError`                                                                                                                                                                                                                                                                                                      |
