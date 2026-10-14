---
title: Google Consent Mode
description: "googleConsentMode() sends the visitor's choice to Google tags as Consent Mode v2 signals, with region defaults and Google's other settings."
---

`googleConsentMode()` sends the visitor's choice to Google tags as
[Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent)
signals. GA4, Google Ads, Floodlight and the tags Google Tag Manager loads all
read them, so the adapter works with or without [`ga4()`](/guides/providers/ga4/).

```ts
import { googleConsentMode } from 'consentlayer/adapters/google-consent-mode'

createAnalytics({
  providers,
  consent: {
    adapters: [
      googleConsentMode({
        regions: [{ region: ['US'], analytics: true, marketing: true }],
        waitForUpdate: 500,
      }),
    ],
  },
})
```

`ga4()` sets the same defaults and updates on its own, so you need the adapter
only for the settings below or for Google tags without `ga4()`. When the
adapter is there, `ga4()` leaves Consent Mode to it, so the defaults are sent
once.

## Options

| Option             | Type                        | Default | Description                                                                                                                           |
| ------------------ | --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `regions`          | `GoogleConsentModeRegion[]` | `[]`    | Categories that count as granted before a choice in the listed regions. See [Region defaults](#region-defaults).                      |
| `waitForUpdate`    | `number`                    | None    | Milliseconds Google tags wait for a consent update before sending, as `wait_for_update` in each default. A whole number, `0` or more. |
| `urlPassthrough`   | `boolean`                   | `false` | `gtag('set', 'url_passthrough', true)`: passes ad click IDs through links while `ad_storage` is denied.                               |
| `adsDataRedaction` | `boolean`                   | `false` | `gtag('set', 'ads_data_redaction', true)`: redacts ad click data while `ad_storage` is denied.                                        |

## Signals

When `createAnalytics()` creates the instance in the browser, before any
network request and whatever the [`boot`](/start/react/#boot-timing) timing,
the adapter creates `window.dataLayer` and `window.gtag` and sets the defaults:
`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage` and
`functionality_storage` denied, `security_storage` granted. Once the visitor
has a choice, from the banner, storage, another tab or another adapter, each
change sends `gtag('consent', 'update')` with this mapping:

| Consent Mode signal                                | Granted when             |
| -------------------------------------------------- | ------------------------ |
| `analytics_storage`                                | `analytics` is granted   |
| `ad_storage`, `ad_user_data`, `ad_personalization` | `marketing` is granted   |
| `functionality_storage`                            | `preferences` is granted |
| `security_storage`                                 | Always                   |

A Google tag that runs before your bundle, such as a Google Tag Manager snippet
at the top of `<head>`, still runs before the defaults exist. Load such tags
after your bundle, or set the defaults yourself in an inline script before
them.

## Region defaults

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
with everything denied. A region default affects Google tags only:
ConsentLayer's consent stays `null` until the visitor chooses, so the banner is
shown and other providers wait. Once the visitor chooses, their choice
replaces the default.

`ga4()` in its default basic mode configures the tag only after consent, so
GA4 never acts on a region default. Use
[`consentMode: 'advanced'`](/guides/providers/ga4/#advanced-mode) for GA4 to
send hits under one; other Google tags on the page act on it either way.

A code that is not two uppercase letters, optionally followed by `-` and up to
three letters or digits, throws, and so does a `waitForUpdate` that is not a
whole number of `0` or more.
