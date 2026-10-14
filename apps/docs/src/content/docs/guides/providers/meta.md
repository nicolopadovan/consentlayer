---
title: Meta Pixel
description: "meta() loads the Meta Pixel after marketing consent and shares event IDs with the Conversions API."
---

`meta()` from `consentlayer/providers/meta` loads the Meta Pixel and sends page
views and events once `marketing` consent is granted.

```ts
import { meta } from 'consentlayer/providers/meta'

meta({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID })
```

## Options

| Option              | Type                  | Default                | Description                                                                                                                       |
| ------------------- | --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pixelId`           | `string \| undefined` | Required               | The 8 to 20 digit pixel ID.                                                                                                       |
| `locale`            | `string`              | `'en_US'`              | The locale segment of the `fbevents.js` URL.                                                                                      |
| `loadBeforeConsent` | `boolean`             | `false`                | Loads the pixel at boot with `fbq('consent', 'revoke')`. See [Loading before consent](/guides/providers/#loading-before-consent). |
| `events`            | `string[] \| false`   | Meta's standard events | The event names sent to the pixel. See [Which events are sent](#which-events-are-sent).                                           |

## How it works

On load, `meta()` runs Meta's bootstrap snippet, calls `fbq('consent', …)`
with the current marketing consent and `fbq('init', pixelId, userData)` with
advanced-matching data (`em`, `ph` as digits only, and `external_id`), then
loads `https://connect.facebook.net/<locale>/fbevents.js`. Every consent
change calls `fbq('consent', 'grant')` or `fbq('consent', 'revoke')`.

Page views are sent as `PageView`; events are sent with `fbq('track')` for
Meta standard events and `fbq('trackCustom')` otherwise. Both carry
`eventID`, the same ID that is forwarded to the Conversions API, so Meta
deduplicates the pair (see [Server-side tracking](/guides/server-side-tracking/)).

## Which events are sent

By default, the pixel receives only the events that map to a Meta standard
event, listed in [Events and identity](/guides/events/#what-each-provider-receives), such as `purchase`, `lead` and
`sign_up`, and Meta's own standard event names. Custom events, including those
from [auto-tracking](/guides/auto-tracking/), stay with your analytics
providers.

To choose the events yourself, list them in `events`, or pass `false` to send
none. The list replaces the default, so include the standard events you still
want:

```ts
meta({ pixelId, events: ['purchase', 'lead', 'quote_requested'] })
```

An event whose [`only`](/guides/events/#event-options) option names the
provider is sent whatever `events` says. The
[server destination](/guides/server-side-tracking/) `metaCapi` takes the same
option and applies the same rule.

## Advanced matching

Meta accepts advanced-matching data only in `fbq('init')`. If the pixel was
initialized with an email address or phone number and marketing consent is
then withdrawn, the pixel stays revoked and sends nothing for the rest of the
page's lifetime, even if consent is granted again. It resumes after a reload.

## Without JavaScript

For visitors without JavaScript, `<MetaPixelNoscript>` from
`consentlayer/react`, `consentlayer/vue`, `consentlayer/svelte`,
`consentlayer/sveltekit`, `consentlayer/solid` or `consentlayer/solidstart`
renders Meta's `<noscript>` image pixel; the Nuxt module registers it, and
`provideMetaPixelNoscript()` from `consentlayer/angular` adds it. It fires
without consent, since those visitors never see a banner. It renders nothing
without `enabled` or while `pixelId` is `undefined` or empty.
