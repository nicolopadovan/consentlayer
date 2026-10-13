# Server-Side Tracking

Two pieces, both from `@nicolopadovan/analytics-consent-manager/server`:

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
import { createAnalyticsHandler } from '@nicolopadovan/analytics-consent-manager/server'
import { metaCapi } from '@nicolopadovan/analytics-consent-manager/server/meta'

export const runtime = 'nodejs'

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
   `x-real-ip`) and the user agent;
4. hashes email, phone and user ID;
5. sends to each destination in parallel and answers 204. Vendor errors go to
   `onError`.

It is a web-standard `(Request) => Promise<Response>`: Next.js App Router,
Remix, Hono, Cloudflare, Bun and Deno use it as is. Meta hashing uses
`node:crypto`, so keep the route on a Node runtime.

`ga4Server` can't be passed to the handler (a type error).

## Server-only events (webhooks)

```ts
import { sendServerEvent } from '@nicolopadovan/analytics-consent-manager/server'
import { ga4Server } from '@nicolopadovan/analytics-consent-manager/server/ga4'
import { metaCapi } from '@nicolopadovan/analytics-consent-manager/server/meta'
import { orderParams } from '@nicolopadovan/analytics-consent-manager/ecommerce'

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
  ([events](./events.md)).

## Writing a destination

```ts
import type { ServerDestination } from '@nicolopadovan/analytics-consent-manager/server'

const myDestination: ServerDestination<true> = {
  id: 'mine',                 // matched against `only`
  requiredConsent: 'analytics',
  forwardBrowserEvents: true, // false keeps it out of createAnalyticsHandler
  async send(event, request) {
    // request: { ip, userAgent, cookies } when there is one; throw on failure
  },
}
```

## Low-level helpers

Still exported for custom routes: `ANALYTICS_MAX_BODY`, `assertSameOrigin`,
`parseCookieHeader`, `parseJsonWithLimit`, `requestInfo`,
`createMetaEventPayload`, `createMetaGraphUrl`, `extractMetaCookies`,
`sanitizeMetaCustomData`, `sendMetaCapiEvent`, `sha256`,
`createGa4MeasurementPayload`, `createGa4CollectUrl`, `sendGa4MeasurementEvent`.
