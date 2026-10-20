---
title: GA4
description: "ga4() sends page views and events to Google Analytics 4 after analytics consent, with Google Consent Mode v2."
---

`ga4()` from `consentlayer/providers/ga4` loads gtag.js and sends page views
and events to Google Analytics 4 once `analytics` consent is granted.

```ts
import { ga4 } from 'consentlayer/providers/ga4'

ga4({ measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID })
```

## Options

| Option               | Type                    | Default    | Description                                                                                                                                               |
| -------------------- | ----------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `measurementId`      | `string \| undefined`   | Required   | The `G-` measurement ID.                                                                                                                                  |
| `loadBeforeConsent`  | `boolean`               | `false`    | Loads gtag.js at boot with Consent Mode denied. See [Loading before consent](/guides/providers/#loading-before-consent).                                  |
| `consentMode`        | `'basic' \| 'advanced'` | `'basic'`  | `'advanced'` loads gtag.js and configures the tag at boot. See [Advanced mode](#advanced-mode).                                                           |
| `serverContainerUrl` | `string`                | None       | Your [server-side GTM](/guides/providers/gtm/#server-side-tagging) tagging server, set as `server_container_url`, so GA4 hits go to it instead of Google. |
| `events`             | `string[] \| false`     | All events | The event names `track()` sends to it; `false` sends none. See [Routing events](/guides/events/#routing-events).                                          |

## How it works

At setup, when `createAnalytics()` creates the instance in the browser and
before any network request, `ga4()` creates `window.dataLayer` and
`window.gtag` and sets the Consent Mode v2 defaults: `ad_storage`,
`ad_user_data`, `ad_personalization`, `analytics_storage` and
`functionality_storage` denied, `security_storage` granted. Once the visitor
has a choice, each consent change sends `gtag('consent', 'update')` with this
mapping:

| Consent Mode signal                                | Granted when             |
| -------------------------------------------------- | ------------------------ |
| `analytics_storage`                                | `analytics` is granted   |
| `ad_storage`, `ad_user_data`, `ad_personalization` | `marketing` is granted   |
| `functionality_storage`                            | `preferences` is granted |
| `security_storage`                                 | Always                   |

`gtag('config', measurementId, { send_page_view: false })` runs once, after
analytics consent is first granted, so GA4 never sends a hit before it. Page
views are sent as `page_view` events with `page_location`, `page_path` and
`page_title`. `identify` sets `user_id` and `user_data` (the email, and the
phone number prefixed with `+`); `reset` clears both. A failed script load is
reported to `onError` with scope `provider-script-load`.

## Advanced mode

`ga4()` uses Consent Mode v2 in what Google calls basic mode by default: the
tag is configured only after `analytics` is granted, so Google receives
nothing before consent. `consentMode: 'advanced'` loads gtag.js and
configures the tag at boot instead:

```ts
ga4({ measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID, consentMode: 'advanced' })
```

In advanced mode the tag is configured at boot, before the visitor chooses.
While consent is denied, Google receives cookieless pings for page views and
events, without cookies, and uses them to model the visitors who decline.
`page()` and `track()` reach GA4 whatever the visitor chose; the Consent Mode
signals decide what Google does with them. `user_id` and `user_data` are set
only while `analytics` is granted.

Advanced mode sends data to Google before consent. Whether that is allowed
depends on the regions you serve and your legal basis; see the
[legal notice](/guides/legal/).

## Consent Mode settings

`ga4()` sets the Consent Mode defaults and updates itself, so it needs
nothing else. For region defaults, `wait_for_update`, URL passthrough or ads
data redaction, add the
[Google Consent Mode adapter](/guides/adapters/google-consent-mode/). `ga4()`
then leaves the defaults and updates to it.

## Redaction

ConsentLayer's [redaction](/guides/redaction/) sets the redacted page URL and
referrer on gtag.js, so every hit GA4 sends carries them. GA4's own data
redaction, in the web data stream settings, does not conflict with it and can
stay on.

## Enhanced measurement

GA4's enhanced measurement runs in gtag.js and does not wait for
ConsentLayer's consent. [Auto-tracking](/guides/auto-tracking/) sends the
same interactions to every provider, only after analytics consent, and
`ga4()` sends them under
[GA4's event names](/guides/auto-tracking/#google-analytics), so the built-in
reports still work.

With auto-tracking on, open **Admin › Data streams › your stream › Enhanced
measurement** and turn off every option except **Page views**. Under the
**Page views** settings, untick **Page changes based on browser history
events**: ConsentLayer sends a page view for each route itself. Otherwise
GA4 counts each interaction twice.
