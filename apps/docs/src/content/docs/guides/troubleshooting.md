---
title: Troubleshooting
description: Fixes for the most common problems.
---

Start with `createAnalytics({ debug: true })`: consentlayer then logs every
consent change and every error to the console. Errors also always reach
`createAnalytics({ onError })`.

## Meta Pixel Helper shows no pixel

- Check that `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is set and that the `meta()`
  provider is in `providers`.
- Grant marketing consent. The pixel doesn't load before it, unless you set
  `loadBeforeConsent: true`.
- With `boot: { mode: 'idle' }`, providers load only once the browser is idle,
  up to `timeoutMs` after the page loads.

## Server-side events don't arrive

- **No request at all.** `server.endpoint` isn't set, or neither analytics nor
  marketing consent is granted.
- **The route answers 403.** The request is cross-origin, or has no `Origin`
  or `Referer` header.
- **The route answers 400.** The body isn't a valid event.
- **The route answers 204 but the vendor shows nothing.** Check `META_TOKEN`
  for Meta and `GA4_API_SECRET` for GA4, and read the errors passed to the
  handler's `onError`.
- **GA4 fails with "needs event.clientId".** The webhook event has no client
  ID; save it with the order while the visitor is in the browser (see
  [Server-side tracking](/guides/server-side-tracking/#send-server-only-events)).

Browser-side forwarding failures reach `createAnalytics({ onError })` with the
scope `server-forward`.

## The banner shows stale consent

- Check that the banner is rendered inside `<AnalyticsProvider>`.
- Check that the page creates `createAnalytics()` only once. A second instance
  has its own consent state; see [Names](/guides/names/).
- Check that the browser stores the choice under `consentlayer_consent`, or
  under your custom key if you set `names`.
