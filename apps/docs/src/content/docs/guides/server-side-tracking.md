---
title: Server-Side Tracking
description: Forward browser events to Meta CAPI and send server-only events to GA4.
---

Two pieces, both from `consentlayer/server`:

- `createAnalyticsHandler`: one route that receives the browser's events and
  forwards them to Meta CAPI.
- `sendServerEvent`: sends events that only the server knows about (a Stripe
  or Shopify webhook) to GA4 and Meta.

Each follows its vendor's recommended setup. Meta dedupes browser and server
events by event ID, so every browser event is also sent to CAPI. GA4 has no
such dedupe and its Measurement Protocol is meant to add to gtag, not mirror
it, so GA4 only receives server-only events.

## Browser → server (Meta CAPI)

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

```ts
createAnalytics({ providers, server: { endpoint: '/api/analytics' } })
```

With `server.endpoint` set, every `track` and `page` is also posted there
(`fetch` with `keepalive`, `sendBeacon` without `fetch`) with its event ID,
the consent it was collected under and the identity consent allows. Nothing
is posted until analytics or marketing is granted. Failures reach `onError`
with scope `server-forward`.

The handler:

1. rejects cross-origin requests (403), bodies over 16 KB (413) and invalid
   events (400);
2. sends only to destinations whose consent category the event carries, and
   honours `only`;
3. reads `_fbp` / `_fbc` / `_ga` cookies, the IP (`x-forwarded-for`, then
   `x-real-ip`) and the user agent. The IP is the first `x-forwarded-for`
   entry, so it is only trustworthy behind a proxy that overwrites the header
   (Vercel does). Proxies that append to it (Cloudflare does) leave that entry
   to the client;
4. hashes email, phone and user ID;
5. sends to each destination in parallel and answers 204. Vendor errors go to
   `onError`.

It is a web-standard `(Request) => Promise<Response>`: Next.js App Router,
Remix, Hono, Cloudflare, Bun and Deno use it as is. It needs only `fetch` and
WebCrypto, so it runs on Node 20+ and edge runtimes alike.

`ga4Server` can't be passed to the handler (a type error).

## Server-only events (webhooks)

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

- Save the consent and the GA client ID with the order while the user is in
  the browser: the webhook has neither. The client ID is the last two parts
  of the `_ga` cookie (`GA1.1.123.456` → `123.456`); inside a request,
  `ga4Server` reads it from the cookie itself.
- GA4 gets `user_id`, and hashed email and phone only with marketing consent
  ([user-provided data collection](https://support.google.com/analytics/answer/14077171)
  must be on), plus the Measurement Protocol `consent` field.
- Event names and params are translated as in the browser
  ([events](/guides/events/)).

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
environment variables. For Meta, prefer a system-user token, and rotate it when
team members leave.

```ts
// Never: anything imported into client code ships in the browser bundle.
'use client'
metaCapi({ pixelId, accessToken: 'EAAB…' })
```

If you're using Next.js, prefer `NEXT_PUBLIC_*` only for the values that are
genuinely safe to expose (the GA4 measurement ID and Meta pixel ID are public
identifiers and may be inlined). The `apiSecret` and `accessToken` must stay
in non-prefixed env vars accessed only inside Route Handlers, Server Actions,
or other server-only code paths.
