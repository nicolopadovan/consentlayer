---
title: TikTok Pixel
description: "tiktok() loads the TikTok Pixel after marketing consent, with TikTok consent mode and event IDs shared with the Events API."
---

`tiktok()` from `consentlayer/providers/tiktok` loads the TikTok Pixel and sends
page views and events once `marketing` consent is granted.

```ts
import { tiktok } from 'consentlayer/providers/tiktok'

tiktok({ pixelId: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID })
```

## Options

| Option              | Type                  | Default                  | Description                                                                                                                |
| ------------------- | --------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `pixelId`           | `string \| undefined` | Required                 | The pixel ID from TikTok Events Manager.                                                                                   |
| `loadBeforeConsent` | `boolean`             | `false`                  | Loads the pixel at boot with `ttq.holdConsent()`. See [Loading before consent](/guides/providers/#loading-before-consent). |
| `events`            | `string[]`            | TikTok's standard events | The event names sent to the pixel. See [Which events are sent](#which-events-are-sent).                                    |

## How it works

On load, `tiktok()` runs TikTok's base code, with the consent mode methods
`holdConsent`, `revokeConsent` and `grantConsent` added to the `ttq` queue.
Before `ttq.load(pixelId)` it calls `ttq.grantConsent()` when marketing is
granted and `ttq.holdConsent()` otherwise, then loads
`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=<pixelId>&lib=ttq`.
A failed load is reported to `onError` with scope `provider-script-load`. The
base code's own `ttq.page()` call is left out, since ConsentLayer sends page
views itself. Every consent change calls `ttq.grantConsent()` or
`ttq.revokeConsent()`.

Page views are sent as `ttq.page()`. Events are sent as
`ttq.track(name, params, { event_id })`, where `event_id` is the same ID that
is forwarded to the Events API, so TikTok deduplicates the pair (see
[Server-side tracking](/guides/server-side-tracking/)). Standard events map to
TikTok's standard events; see [Events and identity](/guides/events/).

## Which events are sent

By default, the pixel receives only the events that map to a TikTok standard
event, listed in [Events and identity](/guides/events/#what-each-provider-receives), such as `purchase`, `lead` and
`sign_up`, and TikTok's own standard event names. Custom events, including those
from [auto-tracking](/guides/auto-tracking/), stay with your analytics
providers.

To choose the events yourself, list them in `events`. The list replaces the
default, so include the standard events you still want:

```ts
tiktok({ pixelId, events: ['purchase', 'lead', 'quote_requested'] })
```

An event whose [`only`](/guides/events/#event-options) option names the
provider is sent whatever `events` says. The
[server destination](/guides/server-side-tracking/) `tiktokEvents` takes the same
option and applies the same rule.

There is no `<noscript>` fallback for TikTok.

## Consent mode

TikTok's Pixel Cookie Consent Mode works on the `ttq` queue:

| Call                  | Effect                                        |
| --------------------- | --------------------------------------------- |
| `ttq.holdConsent()`   | Events are queued and not shared with TikTok. |
| `ttq.grantConsent()`  | Queued and later events are shared.           |
| `ttq.revokeConsent()` | Nothing is shared, including queued events.   |

With `loadBeforeConsent: true`, the pixel loads with `holdConsent` and
`tiktok()` sends nothing until marketing is granted.

## Advanced matching

`identify` calls `ttq.identify()` with `email` (trimmed and lowercased),
`phone_number` (the digits prefixed with `+`, E.164) and `external_id` (the
user ID). The pixel hashes them before sending. If the pixel received an email
address or phone number and marketing consent is then withdrawn, the pixel
stays revoked and sends nothing for the rest of the page's lifetime, even if
consent is granted again. It resumes after a reload.

## Cookies

TikTok documents these first-party cookies for the pixel, each kept for 13
months:

| Cookie                       | Purpose                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| `_ttp`                       | Identifies the browser across visits. The Events API destination reads it. |
| `ttcsid`, `ttcsid_<pixelId>` | The session.                                                               |
| `ttclid`                     | The TikTok click ID from an ad click. The Events API destination reads it. |
