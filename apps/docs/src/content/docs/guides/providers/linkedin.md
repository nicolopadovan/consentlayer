---
title: LinkedIn Insight
description: "linkedin() loads the LinkedIn Insight Tag after marketing consent and sends the events you map to LinkedIn conversions."
---

`linkedin()` from `consentlayer/providers/linkedin` loads the LinkedIn Insight
Tag once `marketing` consent is granted and sends the events you map to
LinkedIn conversions.

```ts
import { linkedin } from 'consentlayer/providers/linkedin'

linkedin({
  partnerId: process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID,
  events: { purchase: 12345678, lead_form: 23456789 },
})
```

## Options

| Option      | Type                            | Default  | Description                                                                                                       |
| ----------- | ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `partnerId` | `number \| string \| undefined` | Required | The Insight Tag partner ID, as a number or a string of digits.                                                    |
| `events`    | `Record<string, number>`        | `{}`     | LinkedIn conversion IDs keyed by the event name passed to `track()`. Events without a conversion ID are not sent. |
| `defer`     | `LoadTiming`                    | `false`  | When to load the tag. See [Loading SDKs later](/guides/providers/#loading-sdks-later).                            |

## Conversions

LinkedIn receives only the events named in `events`. Each key is the name
you pass to `analytics.track()`, a standard event such as `purchase` or one of
your own, and each value is the ID of a conversion in Campaign Manager that is
tracked with the event-specific JavaScript call.

```ts
analytics.track('lead_form')
```

The event above is sent as
`lintrk('track', { conversion_id: 23456789, event_id })`, where `event_id` is
the event's ID. Event parameters are not sent. An event without a conversion
ID is not sent even when its [`only`](/guides/events/#event-options) option
names `linkedin`.

## How it works

Once marketing is granted, `linkedin()` runs LinkedIn's base code: it sets
`window._linkedin_partner_id`, adds the partner ID to
`window._linkedin_data_partner_ids`, defines the `window.lintrk` queue and
loads `https://snap.licdn.com/li.lms-analytics/insight.min.js`. A failed load
is reported to `onError` with scope `provider-script-load`. The tag records
the page load itself; `page()` sends nothing, so client-side navigations are
not reported to LinkedIn.

The base code's `<noscript>` image is not added, since it would send a request
before consent.

## Withdrawing consent

The Insight Tag has no consent switch: once loaded, it keeps running until the
page unloads. When marketing is withdrawn, `linkedin()` stops sending
conversions and expires the first-party cookies listed in
[LinkedIn's cookie table](https://www.linkedin.com/legal/l/cookie-table):
`li_fat_id`, `li_giant`, `oribi_cookie_test`, `oribili_user_guid`, `ln_or` and
`ar_debug`. Cookies LinkedIn sets on its own domains cannot be removed from
your site.
