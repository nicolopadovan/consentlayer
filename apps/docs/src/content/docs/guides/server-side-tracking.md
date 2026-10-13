---
title: Server-side tracking
description: Forward browser events to the Meta Conversions API and send server-only events to GA4 and Meta.
---

Server-side tracking has two parts, both from `consentlayer/server`:

- `createAnalyticsHandler`: one route that receives the browser's events and
  forwards them to the Meta Conversions API (CAPI).
- `sendServerEvent`: sends events that only the server knows about (a Stripe
  or Shopify webhook) to GA4 and Meta.

Each follows its vendor's recommended setup. Meta deduplicates browser and
server events by event ID, so every browser event is also sent to CAPI. GA4
doesn't deduplicate, and its Measurement Protocol is meant to add to gtag, not
mirror it, so GA4 receives only server-only events.

To make the route trust only the consent you recorded, rather than what the
browser sends, see [Consent records](/guides/consent-records/).

## Forward browser events

```ts
// app/api/analytics/route.ts
import { createAnalyticsHandler } from 'consentlayer/server'
import { metaCapi } from 'consentlayer/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [
    metaCapi({
      pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID!,
      accessToken: process.env.META_TOKEN!, // server-only
    }),
  ],
  onError: console.error,
})
```

Then point the instance at the route:

```ts
createAnalytics({ providers, server: { endpoint: '/api/analytics' } })
```

With `server.endpoint` set, every `track` and `page` is also posted there
(with `fetch` and `keepalive`, or `sendBeacon` where `fetch` is missing), with its event ID,
the consent it was collected under and the identity consent allows. Nothing
is posted until analytics or marketing is granted. Failures reach `onError`
with scope `server-forward`.

The handler:

1. Rejects cross-origin requests (403), bodies over 16 KB (413) and invalid
   events (400).
2. Sends only to destinations whose consent category the event carries, and
   honours `only`. With `consentCookie` set, the consent comes from the signed
   cookie instead of the body.
3. Reads the `_fbp`, `_fbc` and `_ga` cookies, the IP address
   (`x-forwarded-for`, then `x-real-ip`) and the user agent. The IP address is
   the first `x-forwarded-for` entry, so it is trustworthy only behind a proxy
   that overwrites the header, as Vercel does. Behind a proxy that appends to
   it, as Cloudflare does, the client controls that entry.
4. Hashes the email, phone and user ID.
5. Sends to each destination in parallel and answers 204. Vendor errors go to
   `onError`.

The handler is a web-standard `(Request) => Promise<Response>`, so the Next.js
App Router, Remix, Hono, Cloudflare Workers, Bun and Deno use it as it is. It
needs only `fetch` and WebCrypto, so it runs on Node 20+ and edge runtimes.

`ga4Server` can't be passed to the handler; TypeScript reports it as an
error.

## Send server-only events

```ts
import { sendServerEvent } from 'consentlayer/server'
import { ga4Server } from 'consentlayer/server/ga4'
import { metaCapi } from 'consentlayer/server/meta'
import { orderParams } from 'consentlayer/ecommerce'

const results = await sendServerEvent(
  {
    id: order.id,               // same ID as a browser purchase event, if any
    name: 'purchase',
    params: orderParams(order),
    consent: order.consent,     // saved at checkout
    clientId: order.gaClientId, // saved at checkout; GA4 needs it
    identity: { userId, email },
  },
  {
    destinations: [
      ga4Server({ measurementId, apiSecret: process.env.GA4_API_SECRET! }),
      metaCapi({ pixelId, accessToken: process.env.META_TOKEN! }),
    ],
  },
)
// [{ id: 'ga4', ok: true }, { id: 'meta', ok: false, error }]
```

Events such as a paid order often reach only your server, through a Stripe or
Shopify webhook. Send them with `sendServerEvent`:

- Save the consent and the GA client ID with the order while the visitor is in
  the browser: the webhook has neither. The client ID is the last two parts
  of the `_ga` cookie (`GA1.1.123.456` → `123.456`); inside a request,
  `ga4Server` reads it from the cookie itself.
- GA4 receives `user_id`, the hashed email and phone only with marketing consent
  ([user-provided data collection](https://support.google.com/analytics/answer/14077171)
  must be on), and the Measurement Protocol `consent` field.
- Event names and params are translated as in the browser
  (see [Events and identity](/guides/events/)).

## Writing a destination

```ts
import type { ServerDestination } from 'consentlayer/server'

const myDestination: ServerDestination<true> = {
  id: 'mine',                 // matched against `only`
  requiredConsent: 'analytics',
  forwardBrowserEvents: true, // false keeps it out of createAnalyticsHandler
  async send(event, request) {
    // request: { ip, userAgent, cookies } when there is one; throw on failure
  },
}
```

## Secrets

`ga4Server` and `metaCapi` take credentials that must never reach the browser
bundle: GA4's `apiSecret` and Meta's `accessToken`. Keep both in server-only
environment variables. For Meta, use a system-user token, and rotate it when
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
