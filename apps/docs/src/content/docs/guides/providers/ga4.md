---
title: GA4
description: "ga4() sends page views and events to Google Analytics 4 after analytics consent, with Google Consent Mode v2."
---

`ga4()` from `consentlayer/providers/ga4` loads gtag.js and sends page views
and events to Google Analytics 4 once `analytics` consent is granted.

```ts
import { ga4 } from 'consentlayer/providers/ga4'

ga4({ measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID })
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `measurementId` | `string \| undefined` | Required | The `G-` measurement ID. |
| `loadBeforeConsent` | `boolean` | `false` | Loads gtag.js at boot with Consent Mode denied. See [Loading before consent](/guides/providers/#loading-before-consent). |
| `consentMode` | `Ga4ConsentMode` | `{ mode: 'basic' }` | Advanced mode, region defaults and other Consent Mode settings. See [Google Consent Mode](#google-consent-mode). |

## How it works

At setup, before any network request, `ga4()` creates `window.dataLayer` and
`window.gtag` and sets the Consent Mode v2 defaults: `ad_storage`,
`ad_user_data`, `ad_personalization`, `analytics_storage` and
`functionality_storage` denied, `security_storage` granted. Once the visitor
has a choice, each consent change sends `gtag('consent', 'update')` with this
mapping:

| Consent Mode signal | Granted when |
|---|---|
| `analytics_storage` | `analytics` is granted |
| `ad_storage`, `ad_user_data`, `ad_personalization` | `marketing` is granted |
| `functionality_storage` | `preferences` is granted |
| `security_storage` | Always |

`gtag('config', measurementId, { send_page_view: false })` runs once, after
analytics consent is first granted, so GA4 never sends a hit before it. Page
views are sent as `page_view` events with `page_location`, `page_path` and
`page_title`. `identify` sets `user_id` and `user_data` (the email, and the
phone number prefixed with `+`); `reset` clears both. A failed script load is
reported to `onError` with scope `provider-script-load`.

## Google Consent Mode

`ga4()` uses Consent Mode v2 in what Google calls basic mode by default: the
tag is configured only after `analytics` is granted, so Google receives
nothing before consent. `consentMode` changes that and adds Google's other
Consent Mode settings:

```ts
ga4({
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  consentMode: {
    mode: 'advanced',
    regions: [{ region: ['US'], analytics: true, marketing: true }],
    waitForUpdate: 500,
    urlPassthrough: true,
    adsDataRedaction: true,
  },
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'basic' \| 'advanced'` | `'basic'` | `'advanced'` loads gtag.js and configures the tag at boot. |
| `regions` | `Ga4RegionDefault[]` | `[]` | Advanced mode only. Categories that count as granted before a choice in the listed regions. |
| `waitForUpdate` | `number` | None | Milliseconds gtag waits for a consent update before sending, as `wait_for_update` in each default. A whole number, `0` or more. |
| `urlPassthrough` | `boolean` | `false` | `gtag('set', 'url_passthrough', true)`: passes ad click IDs through links while `ad_storage` is denied. |
| `adsDataRedaction` | `boolean` | `false` | `gtag('set', 'ads_data_redaction', true)`: redacts ad click data while `ad_storage` is denied. |

### Advanced mode

In advanced mode the tag is configured at boot, before the visitor chooses.
While consent is denied, Google receives cookieless pings for page views and
events, without cookies, and uses them to model the visitors who decline.
`page()` and `track()` reach GA4 whatever the visitor chose; the Consent Mode
signals decide what Google does with them. `user_id` and `user_data` are set
only while `analytics` is granted.

Advanced mode sends data to Google before consent. Whether that is allowed
depends on the regions you serve and your legal basis.

### Region defaults

Each entry in `regions` lists ISO 3166-2 codes, a country such as `'US'` or a
subdivision such as `'US-CA'`, and the categories granted there before a
choice. Every category it leaves out is denied, and visitors outside every
listed region keep the denied defaults. Google picks the entry by the
visitor's location, and the most specific region wins:

```ts
regions: [
  { region: ['US'], analytics: true, marketing: true },
  { region: ['US-CA'], analytics: true },
]
```

Here a visitor in California starts with analytics granted and marketing
denied, the rest of the United States with both granted, and everyone else
with everything denied. A region default affects GA4 only: ConsentLayer's
consent stays `null` until the visitor chooses, so the banner is shown and
other providers wait. Once the visitor chooses, their choice replaces the
default.

Setting `regions` without `mode: 'advanced'` is a type error and throws, since
in basic mode the tag is configured only after consent and Google never acts
on a default. A code that is not two uppercase letters, optionally followed by
`-` and up to three letters or digits, also throws.
