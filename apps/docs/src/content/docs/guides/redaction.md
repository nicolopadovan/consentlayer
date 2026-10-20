---
title: Redaction
description: Replace email addresses and chosen query parameters with (redacted) before any provider or server destination receives them.
---

Page URLs often carry personal data by accident: a sign-up form that submits
with `GET` puts the email address in the query string, and a password reset
link carries a token. ConsentLayer replaces email addresses with `(redacted)`
before a page view or event reaches any provider or server destination. It is
on by default.

```ts
import { createAnalytics } from 'consentlayer'

export const analytics = createAnalytics({
  providers: [/* ... */],
  redact: { queryParams: ['token', 'session_id'] },
})
```

## Options

| Option        | Type       | Default | Description                                                                                    |
| ------------- | ---------- | ------- | ---------------------------------------------------------------------------------------------- |
| `emails`      | `boolean`  | `true`  | Replaces email addresses, including those encoded as `%40`, with `(redacted)`.                 |
| `queryParams` | `string[]` | `[]`    | Query parameters whose values are replaced with `(redacted)`, compared without regard to case. |

`redact: false` turns redaction off. `redact: { emails: false }` keeps email
addresses and still redacts `queryParams`.

With `queryParams: ['token']`, the URL
`https://shop.example/reset?token=abc&email=jane%40example.com` is sent as
`https://shop.example/reset?token=(redacted)&email=(redacted)`.

## What is redacted

- The `url`, `path` and `title` of every page view.
- Every string in the params of `track`, including strings inside nested
  objects and arrays.
- The `url` and params of each event forwarded to the
  [server endpoint](/guides/server-side-tracking/), so server destinations
  receive the redacted values.

Some providers read the page URL and the referrer themselves, outside the page
views ConsentLayer sends. Where the vendor offers a way to replace those
values, the provider uses it.

| Provider                                                                  | Coverage                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Google Analytics 4](/guides/providers/ga4/)                              | Full. Sets the redacted `page_location` and `page_referrer` on gtag.js, which every later hit sends.                                                                     |
| [Google Ads](/guides/providers/google-ads/)                               | Full, in the same way as GA4, including with `pageViews: false`.                                                                                                         |
| [PostHog](/guides/providers/posthog/)                                     | Full. A `before_send` hook redacts the strings in each event's `properties` and `$set_once`, which hold `$current_url`, `$referrer` and the initial URLs.                |
| [Contentsquare](/guides/providers/contentsquare/)                         | Query string and referrer. Sends the redacted query string with `setQuery` and removes the referrer's query string when it would be redacted. Emails in a path are sent. |
| [Sentry](/guides/providers/sentry/)                                       | Query strings are never sent. Error messages and stack traces are not redacted.                                                                                          |
| [Vercel Web Analytics](/guides/providers/vercel/)                         | Events only. Vercel's `<Analytics>` component sends page views itself; redact their URLs with its `beforeSend` option.                                                   |
| [Google Tag Manager](/guides/providers/gtm/)                              | The `page_view` pushed to the data layer. The tags in the container read the URL themselves and are not redacted.                                                        |
| Meta Pixel, TikTok Pixel, LinkedIn Insight Tag, Microsoft Clarity, Hotjar | Events only. These scripts read the page URL and the referrer themselves and offer no way to replace them.                                                               |

## What is not redacted

- The data you pass to `identify` and `group`. An email address there is
  intentional.
- The per-provider params in the `providers` option of `track`.
- Errors sent with `captureError` and the global error handlers.
- The URL in the browser's address bar. A provider that reads it directly, as
  listed above, still receives the original value.

Redaction is a safeguard against accidental collection, not a guarantee that
no personal data reaches a provider. Whether your setup meets your legal
obligations is your responsibility; see the [legal notice](/guides/legal/).

<details>
<summary>How email addresses are detected</summary>

An email address is a run of letters, digits and `.`, `_`, `%`, `+` or `-`,
followed by `@` or `%40`, a domain and a top-level domain of at least two
letters. The match is case-insensitive. It does not detect addresses that are
encoded in other ways, such as Base64.

</details>

## Writing your own provider

`ctx.redact(value)` applies the instance's `redact` option to a string. Use
it on any URL your provider sends that does not come from the page view, such
as `location.href` read inside `load`. See
[Writing your own](/guides/providers/#writing-your-own).
