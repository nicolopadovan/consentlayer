---
title: Campaign parameters
description: Keep the landing page's UTM parameters until consent, so the first page view each provider receives still carries the campaign.
---

Providers attribute a visit to a campaign from the parameters in the page URL,
such as `?utm_source=chatgpt.com`. No provider loads before consent, so a
visitor who lands on `/?utm_source=chatgpt.com`, moves to `/pricing` and
accepts there would give providers a first page view without the campaign.
The visit would count as direct traffic.

ConsentLayer keeps the landing page's campaign parameters and adds the ones
the URL no longer has to the first page view each provider receives. In the
example above, the first page view sent after consent has the URL
`/pricing?utm_source=chatgpt.com`; later page views are sent unchanged. It is
on by default.

```ts
import { createAnalytics } from 'consentlayer'

export const analytics = createAnalytics({
  providers: [/* ... */],
  campaign: { params: ['gclid', 'ref'] },
})
```

## Options

| Option   | Type       | Default | Description                                                                                                                                         |
| -------- | ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params` | `string[]` | `[]`    | Parameter names kept in addition to `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` and `utm_id`. Names are compared exactly. |

`campaign: false` turns it off.

## How it works

- The parameters are read once, when `createAnalytics` runs, and kept in
  memory only. Nothing is written to cookies or storage before consent, so a
  full page load before consent loses them; navigation in a single-page
  application keeps them.
- Each provider receives them once, on the first page view it receives. A
  provider whose consent is granted later, such as a marketing pixel after an
  analytics provider, receives them on its own first page view.
- A parameter the current URL already has keeps its current value.
- The first page view [forwarded to the server](/guides/server-side-tracking/)
  carries them in its `url`. A page view forwarded later to destinations that
  a later grant allows carries them again.
- Parameters listed in [`redact.queryParams`](/guides/redaction/) stay
  redacted.

## Provider coverage

The parameters are added to the page view's `url` and `path`, so they reach
the providers that send that URL:

| Provider                                                                                                       | Coverage                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Google Analytics 4](/guides/providers/ga4/), [Google Ads](/guides/providers/google-ads/)                      | Full. gtag.js sends the URL as `page_location`, from which GA4 reads the campaign. |
| [Google Tag Manager](/guides/providers/gtm/)                                                                   | In the `page_location` of the `page_view` pushed to the data layer.                |
| [PostHog](/guides/providers/posthog/)                                                                          | In `$current_url` only. PostHog reads its `utm_*` properties from the address bar. |
| Server destinations                                                                                            | In the event's `url`.                                                              |
| Meta Pixel, TikTok Pixel, LinkedIn Insight Tag, Microsoft Clarity, Hotjar, Contentsquare, Vercel Web Analytics | None. These read the address bar themselves, or send only the path.                |
