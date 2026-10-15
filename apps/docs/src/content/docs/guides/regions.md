---
title: Privacy laws by region
description: Apply a consent rule per visitor region, such as the US opt-out model, Switzerland's opt-out for analytics and the CNIL's six months, from the country header your host adds.
---

Privacy laws differ in what a site may do before the visitor chooses. Under
the GDPR, nothing that needs consent runs until the visitor gives it; under
the US state laws, tracking may run until the visitor opts out. ConsentLayer
applies a rule per visitor region: you pass the region, read on your server
from the header your host or CDN adds, and ConsentLayer sets the consent in
force before a choice and whether the banner asks for one.

Without a region, ConsentLayer behaves as it always has: nothing that needs
consent runs until the visitor chooses, and the banner asks.

:::caution[Not legal advice]
The rules below are a starting point drawn from regulators' guidance; they
have not been legally reviewed. Which law applies to your site, and what it
requires of your banner, your policies and your vendors, is your
responsibility; see the [legal notice](/guides/legal/).
:::

## The default rules

| Region                                | Before the visitor chooses                                                                          | Banner     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Any region without a rule, or unknown | Every category denied.                                                                              | Asks.      |
| United States (`US`)                  | Every category granted. With [Global Privacy Control](#global-privacy-control), `marketing` denied. | Not shown. |
| Switzerland (`CH`)                    | `preferences` and `analytics` granted, `marketing` and custom categories denied.                    | Asks.      |
| France (`FR`)                         | Every category denied. A choice is asked again after 180 days.                                      | Asks.      |

The opt-in rule covers the EU and EEA, the UK, Brazil, Quebec and every other
region, and any visitor whose region is unknown.

<details>
<summary>What each rule is based on</summary>

- **EU, EEA and UK.** The ePrivacy Directive and the UK's PECR require consent
  before storing or reading anything on a visitor's device that is not
  strictly necessary.
- **United States.** California's CCPA and the comprehensive privacy laws of
  Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Maryland,
  Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode
  Island, Tennessee, Texas, Utah and Virginia let a business process data
  until the consumer opts out of its sale, sharing or use for targeted
  advertising. The rule covers the whole country, so a visitor whose state is
  unknown, or whose state has no such law, gets it too.
- **Switzerland.** The Federal Data Protection and Information Commissioner's
  guidelines on cookies (version 1.1, October 2025) require no consent for
  most tracking but a way to object that is recognisable at once, and
  consent for cross-site advertising tracking.
- **France.** The CNIL's recommendation on cookies (§39) considers keeping a
  choice, consent or refusal, for six months good practice.
- **Brazil.** The ANPD's cookie guide recommends turning consent-based
  cookies off by default and offering a button to reject them.
- **Quebec.** The Commission d'accès à l'information's guidelines 2023-1
  require identification, location and profiling functions to be off by
  default.

</details>

## Pass the region

The `region` option of `createAnalytics({ consent })` is an ISO 3166-2 code:
a country such as `'FR'`, or a country and its first-level subdivision such
as `'US-CA'`. ConsentLayer looks up `'US-CA'`, then `'US'`, then applies the
opt-in rule. The region is read once, when `bootstrap()` runs.

`region` can be a string or a function that returns one, or a promise of
one, in the browser. Pages rendered on the server can put the region in the
HTML; cached and static pages fetch it from a route.

### Read it on the server

`regionFromHeaders(headers)`, from `consentlayer/server`, reads the headers
these hosts add and returns the region, or `undefined`:

| Host              | Country header              | Subdivision header                 | Setup                                                                    |
| ----------------- | --------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Vercel            | `x-vercel-ip-country`       | `x-vercel-ip-country-region`       | None.                                                                    |
| Cloudflare        | `cf-ipcountry`              | `cf-region-code`                   | IP Geolocation on; the subdivision needs "Add visitor location headers". |
| Amazon CloudFront | `cloudfront-viewer-country` | `cloudfront-viewer-country-region` | Add both headers to the origin request policy.                           |

Cloudflare's `XX`, for an unknown country, and `T1`, for Tor, count as
unknown. ConsentLayer reads no IP address and stores no region.

Netlify adds no header: build the region from `context.geo` in a function or
edge function.

```ts
const { country, subdivision } = context.geo
const region = country?.code && (subdivision?.code ? `${country.code}-${subdivision.code}` : country.code)
```

<details>
<summary>The headers are trusted as sent</summary>

A visitor can send these headers themselves when the site runs behind no
host or CDN that sets them. That only changes the rule they get for
themselves. If your server is reachable directly, read the region only from
a header your own proxy sets.

</details>

### Put it in the page

In Next.js, read the region in the root layout and render it on `<html>`:

```tsx title="app/layout.tsx"
import { regionFromHeaders } from 'consentlayer/server'
import { headers } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-region={regionFromHeaders(await headers())}>
      <body>{children}</body>
    </html>
  )
}
```

```ts title="lib/analytics.ts"
export const analytics = createAnalytics({
  providers,
  consent: { region: () => document.documentElement.dataset.region },
})
```

Reading the headers renders the layout on every request. Use the same
pattern in any framework that renders on the server: SvelteKit's
`event.request.headers`, Nuxt's `useRequestHeaders()`, or the `Request` your
server receives.

### Fetch it from a route

A page served from a cache is the same for every visitor, so it cannot carry
the region. Fetch it instead, from a route that is never cached:

```ts title="app/api/region/route.ts"
import { regionFromHeaders } from 'consentlayer/server'

export function GET(request: Request) {
  return new Response(regionFromHeaders(request.headers) ?? '', {
    headers: { 'cache-control': 'private, no-store' },
  })
}
```

```ts title="lib/analytics.ts"
export const analytics = createAnalytics({
  providers,
  consent: { region: () => fetch('/api/region').then((response) => response.text()) },
})
```

Bootstrap waits for the response, so nothing that needs consent loads before
it. If the request fails, the error goes to `onError` with scope
`consent-region` and the opt-in rule applies.

### The script tag

Set `data-region` on the [script tag](/start/script-tag/), or
`consent.region` in `window.ConsentLayer`:

```html
<script src="https://cdn.jsdelivr.net/npm/consentlayer@1/dist/consentlayer.global.js" data-region="US-CA"></script>
```

## Change the rules

The `regions` option is merged over the default rules. Each key is a country
or a country and subdivision; each value is a rule:

| Field        | Type                         | Default | Description                                                                                                                  |
| ------------ | ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `granted`    | `ConsentCategory[] \| 'all'` | `[]`    | Categories in force before the visitor chooses. They apply but are not stored. Global Privacy Control turns `marketing` off. |
| `banner`     | `boolean`                    | `true`  | Whether the banner asks a visitor who has not chosen.                                                                        |
| `maxAgeDays` | `number`                     | None    | A stored choice older than this is [stale](/guides/consent-ui/#asking-again) in the region, when shorter than `maxAgeDays`.  |

`{}` is the opt-in rule, so it also turns a default rule off:

```ts title="lib/analytics.ts"
import { canadaRegions, createAnalytics, ukStatisticsRegions } from 'consentlayer'

export const analytics = createAnalytics({
  providers,
  consent: {
    region,
    regions: { ...canadaRegions, ...ukStatisticsRegions, FR: {} },
  },
})
```

Two sets of rules ship off by default:

- **`canadaRegions`** grants every category in Canada outside Quebec, with the
  banner as notice and a way to object, following the Office of the Privacy
  Commissioner's guidance on online behavioural advertising. Quebec stays
  opt-in.
- **`ukStatisticsRegions`** grants `analytics` in the UK, with the banner. The
  UK's exception for storage used only for statistics, in Schedule A1 to
  PECR, applies only under conditions your analytics setup must meet, such as
  a free and simple way to object.

## Your interface in each region

`analytics.consent.getRegion()` returns `{ region, rule }` once bootstrap has
resolved, so your interface can match the region. `shouldAsk()` is `true`
when the banner should ask: the visitor has not chosen, the choice is stale,
or only the region's defaults are in force, and the rule shows a banner.
`bannerVisible` on [`useConsentController()`](/guides/consent-ui/) follows it.

Where the banner does not ask, the visitor still needs a way to choose. The
California regulations, for example, require a "Do Not Sell or Share My
Personal Information" link, or an alternative titled "Your Privacy Choices",
in the header or footer. Open the settings dialog from it:

```tsx
{
  analytics.consent.getRegion().rule.banner === false && (
    <button type="button" onClick={openDialog}>
      Your Privacy Choices
    </button>
  )
}
```

### Global Privacy Control

Under a rule that grants `marketing`, the
[Global Privacy Control](/guides/consent-ui/#global-privacy-control) signal
keeps it denied before the visitor chooses. `gpc` is then `true`, so your
interface can show that the signal was honored; the California regulations
give "Opt-Out Request Honored" as an example.
