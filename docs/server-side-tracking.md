# Server-Side Tracking

The package exports pure helpers from `@nicolopadovan/analytics-consent-manager/server`. Route handlers stay in the consumer app.

## Exports

- `ANALYTICS_MAX_BODY`
- `assertSameOrigin`
- `parseCookieHeader`
- `parseJsonWithLimit`
- `createMetaEventPayload`
- `createMetaGraphUrl`
- `extractMetaCookies`
- `sanitizeMetaCustomData`
- `sendMetaCapiEvent`
- `sha256`
- `createGa4MeasurementPayload`
- `createGa4CollectUrl`
- `sendGa4MeasurementEvent`

## Meta CAPI Pattern

Reference route:

- [`apps/example-next/app/api/facebook/track/route.ts`](../apps/example-next/app/api/facebook/track/route.ts)

Expected steps:

1. enforce same-origin with `assertSameOrigin`
2. parse a limited JSON body with `parseJsonWithLimit`
3. build the payload with `createMetaEventPayload`
4. forward it with `sendMetaCapiEvent`

The browser-side Meta adapter reuses the same event id for browser and server dispatch so dedupe remains intact.

## GA4 Measurement Protocol Pattern

Reference route:

- [`apps/example-next/app/api/ga4/track/route.ts`](../apps/example-next/app/api/ga4/track/route.ts)

Expected steps:

1. enforce same-origin with `assertSameOrigin`
2. parse the limited JSON body
3. build the payload with `createGa4MeasurementPayload`
4. send it with `sendGa4MeasurementEvent`

## Runtime Notes

- Meta hashing uses Node crypto, so keep the Meta route on a Node runtime
- routes should remain app-local because origin policy, auth, and deployment details belong to the consumer app
