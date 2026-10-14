---
title: Server-side tracking
description: Forward browser events to the Meta Conversions API and the TikTok Events API, and send server-only events to GA4, Meta and TikTok.
---

This page covers the two server entry points in `consentlayer/server`, the
built-in destinations for the Meta Conversions API, the TikTok Events API and
the GA4 Measurement Protocol, writing your own destination, and handling the vendor secrets.

- `createAnalyticsHandler` is a route handler that receives the events the
  browser forwards and sends them to the Meta Conversions API (CAPI) and the
  TikTok Events API.
- `sendServerEvent` sends events that only the server observes, such as a
  Stripe or Shopify webhook, to GA4, Meta and TikTok.

The split follows each vendor's recommended setup. Meta and TikTok
deduplicate browser and server events that share an event ID, so every
browser event is also sent to CAPI and the Events API. GA4 does not deduplicate, and its Measurement Protocol is meant to
supplement gtag rather than mirror it, so GA4 receives only server-only events.

To make the route trust only consent you recorded, instead of the consent the
browser reports, see [Consent records](/guides/consent-records/).

## Forward browser events

```ts
// app/api/analytics/route.ts
import { createAnalyticsHandler } from 'consentlayer/server'
import { metaCapi } from 'consentlayer/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [
    metaCapi({
      pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID,
      accessToken: process.env.META_TOKEN,
    }),
  ],
  onError: console.error,
})
```

`metaCapi()` returns `undefined` while either value is unset, and the handler
skips `undefined` destinations, so the same route works in environments
without the token. With no destination left, the route answers the first
event with the header `consentlayer-forwarding: off`, and the browser stops
posting events until the page is reloaded.

Point the instance at the route. `server.endpoint` must be an HTTPS URL or a
path starting with `/`; `undefined` or `''` turns forwarding off, and any
other value throws when `createAnalytics` is called.

```ts
createAnalytics({ providers, server: { endpoint: '/api/analytics' } })
```

### What the browser sends

With `server.endpoint` set, every `track` and `page` call is also posted to
the endpoint as JSON, independently of which browser providers are active.
Calls made before `boot()` are posted once it completes. Nothing is posted unless analytics or marketing consent is
granted, and an event blocked by `requireAnalyticsConsent` or
`requireMarketingConsent` is not posted either. The request uses `fetch` with
`keepalive: true`, or `navigator.sendBeacon` where `fetch` is unavailable. A
failed request or a non-2xx response is reported to `onError` with scope
`server-forward`.

| Field | Content |
|---|---|
| `id` | The event ID, shared with the browser providers so Meta can deduplicate. |
| `name` | The event name; `page_view` for `page()`. |
| `params` | The event params (omitted for page views). |
| `url` | `location.href` at the time of the call, or the `url` passed to `page()`. |
| `consent` | The consent the event was collected under, including custom categories. |
| `identity` | The user ID, plus the email and phone number only with marketing consent. |
| `only` | The call's `only` option, if set. |
| `providers` | The call's per-provider params, if set. |

### How the handler processes a request

The handler is a web-standard `(request: Request) => Promise<Response>`. For
each request it:

1. Checks the origin. The `Origin` header, or the origin of `Referer` when
   `Origin` is absent, must equal the request URL's origin. A request with
   neither header, a malformed `Referer` or a different origin gets 403.
2. Reads the body. A `Content-Type` other than `application/json` gets 415, a
   body over 16 KB (16,384 bytes) gets 413, and an empty body or invalid JSON
   gets 400.
3. Validates the event and answers 400 if it is invalid.
4. With `consentCookie` set, replaces the body's `consent` with the consent in
   the signed cookie, or with everything denied if the cookie is missing or
   its signature does not verify.
5. Selects the destinations whose `requiredConsent` category is `true` in the
   event's consent and, when the event has `only`, whose `id` is listed in it.
6. Reads the client IP address, the user agent and the cookies (including
   `_fbp`, `_fbc` and `_ga`) and passes them to each destination.
7. Sends to the selected destinations in parallel and answers 204 once all
   have settled. Each destination failure is passed to `onError`; it does not
   change the response.

Responses have no body. An unexpected error is passed to `onError` and
answered with 500; the rejections in steps 1 to 3 are not reported.

The IP address is the first entry of `x-forwarded-for`, falling back to
`x-real-ip`. That entry is trustworthy only behind a proxy that overwrites
the header, as Vercel does. Behind a proxy that appends to it, as Cloudflare
does, the client controls the first entry.

The handler needs only `fetch` and Web Crypto, so it runs unchanged in the
Next.js App Router, Remix, Hono, Cloudflare Workers, Bun, Deno and Node.js 20
or later.

<details>
<summary>Handler options and body validation</summary>

| Option | Type | Description |
|---|---|---|
| `destinations` | `(ServerDestination<true> \| undefined)[]` | Destinations that accept browser events. Passing `ga4Server(…)` is a type error, any destination with `forwardBrowserEvents: false` is skipped at runtime, and `undefined` entries are ignored. |
| `consentCookie` | `{ secret: string \| undefined; cookie?: string }` | Takes consent from the signed cookie set by `createConsentHandler`. With `secret` unset, every event is treated as denied and the handler logs a `console.warn` once when created; a secret shorter than 32 characters makes every request answer `500`. See [Consent records](/guides/consent-records/). |
| `onError` | `(error: unknown) => void` | Receives destination failures and unexpected errors. |

An event is valid when:

- `name` is a string of 1 to 100 characters from `A–Z`, `a–z`, `0–9`, `_`,
  `.`, `:` and `-`;
- `consent` is an object whose `preferences`, `analytics` and `marketing` are
  booleans, even when `consentCookie` will replace it;
- `id`, `url` and `clientId`, when present, are strings;
- `params` and `providers`, when present, are plain objects;
- `only`, when present, is an array of strings;
- `identity`, when present, is an object whose values are strings or
  `undefined`.

</details>

### Global Privacy Control

A browser that sends the Global Privacy Control signal adds the header
`Sec-GPC: 1` to its requests. `createAnalyticsHandler` does not read it: it
follows the event's consent, which already reflects the signal. In the
browser, "Accept all" leaves `marketing` denied while the signal is on, so the
event's `marketing` is `true` only when the visitor switched it on
explicitly, chose before the signal was on, or chose in a consent adapter
such as a [TCF CMP](/guides/adapters/tcf/). Those choices win on the
[browser side](/guides/consent-ui/#global-privacy-control), and the server
matches it. A client other than ConsentLayer that posts events must apply the
signal to the consent it sends.

## Send server-only events

Some events, such as a paid order, reach only your server, through a payment
or commerce webhook. Send them with `sendServerEvent`:

```ts
import { sendServerEvent } from 'consentlayer/server'
import { ga4Server } from 'consentlayer/server/ga4'
import { metaCapi } from 'consentlayer/server/meta'
import { orderParams } from 'consentlayer/ecommerce'

const results = await sendServerEvent(
  {
    id: order.id,               // the browser purchase event's ID, if there was one
    name: 'purchase',
    params: orderParams(order),
    consent: order.consent,     // saved at checkout
    clientId: order.gaClientId, // saved at checkout; required by GA4
    identity: { userId, email },
  },
  {
    destinations: [
      ga4Server({
        measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
        apiSecret: process.env.GA4_API_SECRET,
      }),
      metaCapi({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID, accessToken: process.env.META_TOKEN }),
    ],
  },
)
// [{ id: 'ga4', ok: true }, { id: 'meta', ok: false, error }]
```

`sendServerEvent` applies the same selection as the handler: a destination
receives the event only if its `requiredConsent` category is `true` in
`event.consent` and, when `only` is set, its `id` is listed. The selected
destinations are called in parallel. The promise never rejects because of a
destination; it resolves to one `{ id, ok, error? }` result per selected
destination, in the order they were passed. Destinations skipped for lack of
consent or by `only`, and `undefined` entries such as a `ga4Server()` without
its secret, do not appear in the results.

A webhook carries neither the visitor's consent nor their GA client ID, so
save both with the order while the visitor is still in the browser. The client
ID is the last two dot-separated parts of the `_ga` cookie (`GA1.1.123.456`
becomes `123.456`).

When the event is sent while handling the visitor's own request, such as in a
server action or a route the browser calls, also pass
`request: requestInfo(request)`. `requestInfo` from `consentlayer/server`
reads the visitor's IP, user agent and cookies, so Meta receives `_fbp`,
`_fbc` and the client details, and `ga4Server` falls back to the `_ga` cookie
when `clientId` is omitted. Do not pass a webhook's request: it comes from the
payment provider, not from the visitor.

```ts
import { requestInfo, sendServerEvent } from 'consentlayer/server'

export async function POST(request: Request) {
  // …
  await sendServerEvent(event, { destinations, request: requestInfo(request) })
}
```

Event names and params are translated as in the browser; see
[Events and identity](/guides/events/).

<details>
<summary>Types</summary>

```ts
type ServerEvent = {
  id?: string                 // shared with the browser event for deduplication
  name: string
  params?: Record<string, unknown>
  consent: ConsentState       // the consent the event was collected under
  identity?: { userId?: string; email?: string; phone?: string }
  url?: string
  clientId?: string           // GA4 client ID; read from the _ga cookie when omitted
  only?: string[]
  providers?: Record<string, Record<string, unknown>>
}

type ServerRequestInfo = {
  ip?: string
  userAgent?: string
  cookies: Record<string, string>
}

function sendServerEvent(
  event: ServerEvent,
  options: { destinations: (ServerDestination | undefined)[]; request?: ServerRequestInfo },
): Promise<{ id: string; ok: boolean; error?: unknown }[]>

function requestInfo(request: Request): ServerRequestInfo
```

</details>

## Destinations

### Meta Conversions API

`metaCapi` from `consentlayer/server/meta` requires marketing consent and
accepts browser events, so it can be passed to both `createAnalyticsHandler`
and `sendServerEvent`. Its `id` is `meta`.

| Option | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | Required | The pixel ID. |
| `accessToken` | `string \| undefined` | Required | A Conversions API access token. Server only. |
| `testEventCode` | `string` | None | Sent as `test_event_code`, so events appear in Events Manager's Test Events tab. |
| `apiVersion` | `string` | `'v26.0'` | The Graph API version. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | The `fetch` used for the request. |

Both values are trimmed. While `pixelId` or `accessToken` is `undefined`, empty
or only whitespace, `metaCapi()` returns
`undefined` and the destination is off. When only one of them is set, it also
logs a `console.warn` once, since that is usually a missing variable.

<details>
<summary>Request sent to Meta</summary>

Each event is one `POST` to
`https://graph.facebook.com/<apiVersion>/<pixelId>/events`, with
`access_token` (and `test_event_code`, when set) in the query string and a
single entry in `data`:

| Field | Value |
|---|---|
| `event_name` | The Meta name for the event: a standard event where one maps, otherwise the original name. |
| `event_time` | The send time, in Unix seconds. |
| `event_id` | The event's `id`, which Meta uses to deduplicate it against the pixel event. |
| `event_source_url` | The event's `url`. |
| `action_source` | `website`. |
| `custom_data` | The translated params, keeping only strings, numbers, booleans, `null`, arrays and plain objects. |
| `user_data.client_ip_address`, `client_user_agent` | From the request, when there is one. |
| `user_data.fbp`, `fbc` | The `_fbp` and `_fbc` cookies, when there is a request. |
| `user_data.em` | The SHA-256 hex digest of the trimmed, lowercased email, if it is a valid address. |
| `user_data.ph` | The SHA-256 hex digest of the phone number's digits, without `+`, if it is a valid E.164 number. |
| `user_data.external_id` | The SHA-256 hex digest of the user ID. |

A non-2xx response throws `Meta CAPI <status>: <response body>`.

</details>

### TikTok Events API

`tiktokEvents` from `consentlayer/server/tiktok` requires marketing consent
and accepts browser events, so it can be passed to both
`createAnalyticsHandler` and `sendServerEvent`. Its `id` is `tiktok`.

```ts
import { tiktokEvents } from 'consentlayer/server/tiktok'

tiktokEvents({
  pixelId: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  accessToken: process.env.TIKTOK_TOKEN,
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `pixelId` | `string \| undefined` | Required | The pixel ID, sent as `event_source_id`. |
| `accessToken` | `string \| undefined` | Required | An Events API access token. Server only. |
| `testEventCode` | `string` | None | Sent as `test_event_code`, so events appear in Events Manager's Test Events tab. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | The `fetch` used for the request. |

Both values are trimmed. While `pixelId` or `accessToken` is `undefined`, empty
or only whitespace, `tiktokEvents()` returns `undefined` and the destination
is off, with a `console.warn` once when only one of them is set.

TikTok deduplicates a pixel event and an Events API event with the same pixel
ID, event name and `event_id`. `tiktok()` and `tiktokEvents()` translate
event names the same way and both use the ConsentLayer event ID, so each
`track()` call is counted once. `ttq.page()` takes no event ID, so
`tiktokEvents()` skips `page_view` events and TikTok receives page views from
the pixel only.

<details>
<summary>Request sent to TikTok</summary>

Each event is one `POST` to
`https://business-api.tiktok.com/open_api/v1.3/event/track/`, with the
`Access-Token` header and this body:

| Field | Value |
|---|---|
| `event_source` | `web`. |
| `event_source_id` | The pixel ID. |
| `test_event_code` | `testEventCode`, when set. |
| `data[0].event` | The TikTok name for the event: a standard event where one maps, otherwise the original name. |
| `data[0].event_time` | The send time, in Unix seconds. |
| `data[0].event_id` | The event's `id`, which TikTok uses to deduplicate it against the pixel event. |
| `data[0].user.email` | The SHA-256 hex digest of the trimmed, lowercased email, if it is a valid address. |
| `data[0].user.phone` | The SHA-256 hex digest of the phone number's digits prefixed with `+`, if it is a valid E.164 number. |
| `data[0].user.external_id` | The SHA-256 hex digest of the user ID. |
| `data[0].user.ip`, `user_agent` | From the request, when there is one. |
| `data[0].user.ttp`, `ttclid` | The `_ttp` and `ttclid` cookies, when there is a request. |
| `data[0].properties` | The translated params, merged with `providers.tiktok`. |
| `data[0].page.url` | The event's `url`. |

TikTok answers HTTP 200 with a `code` that is `0` on success. A non-2xx
response or a non-zero `code` throws
`TikTok Events API <status or code>: <message>`.

</details>

### GA4 Measurement Protocol

`ga4Server` from `consentlayer/server/ga4` requires analytics consent and has
`forwardBrowserEvents: false`, so it can be passed only to `sendServerEvent`.
Its `id` is `ga4`.

| Option | Type | Default | Description |
|---|---|---|---|
| `measurementId` | `string \| undefined` | Required | The `G-` measurement ID. |
| `apiSecret` | `string \| undefined` | Required | A Measurement Protocol API secret. Server only. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | The `fetch` used for the request. |

Both values are trimmed. While either is `undefined`, empty or only whitespace,
`ga4Server()` returns `undefined` and the
destination is off, with a `console.warn` once when only one of them is set.

GA4 always receives the user ID, when there is one. The hashed email and
phone number are added only with marketing consent, and they are used only if
[user-provided data collection](https://support.google.com/analytics/answer/14077171)
is turned on in the property. The Measurement Protocol `consent` field is set
from marketing consent.

<details>
<summary>Request sent to GA4</summary>

Each event is one `POST` to `https://www.google-analytics.com/mp/collect`,
with `measurement_id` and `api_secret` in the query string and this body:

| Field | Value |
|---|---|
| `client_id` | `event.clientId`, or the client ID from the request's `_ga` cookie. |
| `user_id` | `event.identity.userId`. |
| `user_data` | With marketing consent only: `sha256_email_address` (trimmed, lowercased) and `sha256_phone_number` (digits prefixed with `+`), each when valid. Omitted when empty. |
| `consent` | `ad_user_data` and `ad_personalization`, both `GRANTED` with marketing consent and `DENIED` without it. |
| `events[0].name` | The event name with every character outside `A–Z`, `a–z`, `0–9` and `_` replaced by `_`; `lead` becomes `generate_lead`. |
| `events[0].params` | The params merged with `providers.ga4`, plus `page_location` from `event.url` when there is one. |

Without a client ID, `send` throws `ga4Server needs event.clientId or the _ga
cookie` before any request is made. A non-2xx response throws
`GA4 Measurement Protocol <status>: <response body>`.

</details>

### Server-side GTM

`sgtm` from `consentlayer/server/sgtm` sends events to a
[server-side GTM](https://developers.google.com/tag-platform/tag-manager/server-side)
container, through its Measurement Protocol client. It requires analytics
consent and has `forwardBrowserEvents: true`, so it takes browser events from
`createAnalyticsHandler` as well as server-only events from `sendServerEvent`.
Its `id` is `sgtm`.

```ts
import { createAnalyticsHandler } from 'consentlayer/server'
import { sgtm } from 'consentlayer/server/sgtm'

export const POST = createAnalyticsHandler({
  destinations: [
    sgtm({ url: 'https://sgtm.example.com/mp/collect', measurementId: process.env.GA_MEASUREMENT_ID }),
  ],
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string \| undefined` | Required | The client's endpoint: your tagging server followed by the activation path set in the client, such as `/mp/collect`. HTTPS only. |
| `measurementId` | `string \| undefined` | Required | Sent as `measurement_id`. |
| `apiSecret` | `string` | | Sent as `api_secret`, for a client or tag that checks it. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | The `fetch` used for the request. |

While `url` or `measurementId` is unset, `sgtm()` returns `undefined` and the
destination is off, with a `console.warn` once when only one of them is set.
The body is the one [sent to GA4](#ga4-measurement-protocol), so the event
needs a client ID or a `_ga` cookie, and errors name `sgtm` and
`Server-side GTM`. The container's tags decide where each event goes from
there. Google's Measurement Protocol client
[doesn't support every Measurement Protocol feature](https://developers.google.com/tag-platform/tag-manager/server-side/send-data).

:::caution[Send each event once]
`ga4({ serverContainerUrl })` already sends the browser's GA4 hits to the
same container. With it and `sgtm()` in `createAnalyticsHandler`, each event
arrives twice. Use one route per event.
:::

## Writing a destination

A destination is an object implementing `ServerDestination`:

```ts
import type { ServerDestination } from 'consentlayer/server'

const myDestination: ServerDestination<true> = {
  id: 'mine',                 // matched against `only`
  requiredConsent: 'analytics',
  forwardBrowserEvents: true, // false keeps it out of createAnalyticsHandler
  async send(event, request) {
    // request is a ServerRequestInfo when there is a request; throw on failure
  },
}
```

`requiredConsent` is a consent category name, built-in or custom; unlike a
browser provider, a destination cannot use `'none'` or a function. The type
parameter is the literal value of `forwardBrowserEvents`, which is what lets
TypeScript reject a server-only destination in `createAnalyticsHandler`. A
thrown error becomes `{ ok: false, error }` in `sendServerEvent`'s results,
or an `onError` call in the handler.

## Secrets

`ga4Server` and `metaCapi` take credentials that must never reach the browser
bundle: GA4's `apiSecret` and Meta's `accessToken`. Keep both in server-only
environment variables. For Meta, use a system-user token and rotate it when
someone with access leaves the team.

```ts
// Never: anything imported into client code ships in the browser bundle.
'use client'
metaCapi({ pixelId, accessToken: 'EAAB…' })
```

In Next.js, only public identifiers belong in `NEXT_PUBLIC_*` variables: the
GA4 measurement ID and the Meta pixel ID. Keep `apiSecret` and `accessToken`
in variables without the prefix, and read them only in route handlers, server
actions or other server-only code.
