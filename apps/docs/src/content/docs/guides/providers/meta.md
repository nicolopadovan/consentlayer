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

| Option              | Type                  | Default   | Description                                                                                                                       |
| ------------------- | --------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pixelId`           | `string \| undefined` | Required  | The 8 to 20 digit pixel ID.                                                                                                       |
| `locale`            | `string`              | `'en_US'` | The locale segment of the `fbevents.js` URL.                                                                                      |
| `loadBeforeConsent` | `boolean`             | `false`   | Loads the pixel at boot with `fbq('consent', 'revoke')`. See [Loading before consent](/guides/providers/#loading-before-consent). |

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
