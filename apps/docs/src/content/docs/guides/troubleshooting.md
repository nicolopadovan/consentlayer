---
title: Troubleshooting
description: Fixes for common problems.
---

## Meta Pixel Helper Shows No Pixel

Check:

- `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is set
- marketing consent has been granted
- lazy boot has had time to run if the app uses `idle` mode
- the Meta provider is registered in consumer code

## Server-Side Meta Or GA4 Events Fail

Check:

- `onError` on `createAnalytics` (scope `server-forward`) and on `createAnalyticsHandler`
- `META_TOKEN` for Meta, `GA4_API_SECRET` for GA4
- the handler answers 403: the request is cross-origin or has no `Origin` / `Referer`
- the handler answers 400: the body isn't a valid event
- GA4 fails with "needs event.clientId": the webhook event has no saved client ID
- no request at all: `server.endpoint` isn't set, or neither analytics nor marketing is granted

## Consent Looks Stale In The UI

Check:

- the rendered page content is inside the consent/provider tree
- the consumer uses the same engine instance for the shell and the UI
- storage is writing to `consentlayer_consent` (or your `names` key)
