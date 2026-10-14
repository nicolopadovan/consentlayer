---
title: Google Ads
description: "googleAds() loads the Google tag after marketing consent and sends the events you map to Google Ads conversions, with Consent Mode v2."
---

`googleAds()` from `consentlayer/providers/google-ads` loads the Google tag
once `marketing` consent is granted, sends page views for remarketing and
sends the events you map to Google Ads conversions.

```ts
import { googleAds } from 'consentlayer/providers/google-ads'

googleAds({
  conversionId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  events: { purchase: 'AbC-D_efG-h12_34-567', lead_form: 'XyZ-1a2B3c' },
})
```

## Options

| Option         | Type                     | Default  | Description                                                                                                       |
| -------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `conversionId` | `string \| undefined`    | Required | The Google Ads tag ID, `AW-` followed by digits.                                                                  |
| `events`       | `Record<string, string>` | `{}`     | Conversion labels keyed by the event name passed to `track()`. Events without a label are not sent to Google Ads. |
| `pageViews`    | `boolean`                | `true`   | Sends a `page_view` to the tag on every page, for remarketing audiences. `false` sends conversions only.          |
| `defer`        | `LoadTiming`             | `false`  | When to load the tag. See [Loading SDKs later](/guides/providers/#loading-sdks-later).                            |

## Conversions

Google Ads receives only the events named in `events`. Each key is the
name you pass to `analytics.track()`, a standard event such as `purchase` or
one of your own, and each value is the conversion label from the event
snippet of a conversion action in Google Ads: the part after the slash in
`send_to: 'AW-123456789/AbC-D_efG-h12_34-567'`.

```ts
analytics.track('purchase', { transaction_id: 'T-1001', value: 49.9, currency: 'EUR' })
```

The event above is sent as:

```ts
gtag('event', 'conversion', {
  value: 49.9,
  currency: 'EUR',
  transaction_id: 'T-1001',
  send_to: 'AW-123456789/AbC-D_efG-h12_34-567',
})
```

An event without a label is not sent even when its
[`only`](/guides/events/#event-options) option names `google-ads`.

`value`, `currency` and `transaction_id` are copied from the event's
parameters when they are set; Google Ads uses `transaction_id` to count an
order once. Other parameters are not sent. To add fields for one call, pass
them under the provider's ID:

```ts
analytics.track('purchase', params, { providers: { 'google-ads': { new_customer: true } } })
```

## How it works

At setup, before any network request, `googleAds()` creates `window.dataLayer`
and `window.gtag` and sets the Consent Mode v2 defaults, as
[`ga4()`](/guides/providers/ga4/#how-it-works) does: every signal is denied
except `security_storage`. Each consent change then sends
`gtag('consent', 'update')`. `ad_storage`, `ad_user_data` and
`ad_personalization` follow `marketing`.

Once marketing is granted, `gtag('config', conversionId, { send_page_view: false })`
runs and gtag.js loads from
`https://www.googletagmanager.com/gtag/js?id=<conversionId>`. A failed load is
reported to `onError` with scope `provider-script-load`. Page views are sent as
`page_view` events with `page_location`, `page_path`, `page_title` and
`send_to` set to the tag ID.

When marketing is withdrawn, the `_gcl_` cookies that the tag sets on your
domain are expired.

<details>
<summary>Using Google Ads with GA4 or Google Tag Manager</summary>

`googleAds()`, `ga4()` and `gtm()` share one `window.gtag` and one
`dataLayer`. The Consent Mode defaults and updates are sent once for all of
them, and gtag.js is loaded once per page, with the ID of the first tag that
loads; every other tag is added to it with its own `config` command.

`ga4()` addresses its page views and events to its measurement ID with
`send_to`, and `googleAds()` addresses its own to the Ads tag, so GA4 events
never reach Google Ads and Google Ads receives only the conversions you
mapped.

With the [Google Consent Mode adapter](/guides/adapters/google-consent-mode/)
on the page, `googleAds()` leaves the defaults and updates to it.

</details>

`googleAds()` does not send enhanced conversions data, and has no server
destination.
