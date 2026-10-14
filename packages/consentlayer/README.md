# consentlayer

Consent-first analytics for the browser and the server. You call one API;
ConsentLayer decides, from the visitor's consent, which providers load, what
each one receives and when, and translates your events into each provider's
format.

- **Providers:** GA4, Google Tag Manager, Meta Pixel, TikTok Pixel, PostHog,
  Sentry, Contentsquare, Vercel Analytics, and your own plugins.
- **Consent:** categories `preferences`, `analytics` and `marketing`, plus
  your own. A provider loads only once its category is granted, or in its
  vendor's consent mode, and stops on withdrawal. Global Privacy Control is
  honored. Consent adapters read an IAB TCF CMP, sync Shopify's Customer
  Privacy API and send Google Consent Mode signals.
- **Light:** each provider is its own entry point, and vendor SDKs and heavy
  features (Replay, tracing, session recording) are chunks loaded only when
  used.
- **Frameworks:** bindings for React, Next.js, Vue, Nuxt, Svelte, SvelteKit,
  Solid, SolidStart and Angular, plus a script-tag build with an optional
  banner. On npm you build your own banner on `useConsentController()`.
- **Server:** forward browser events to the Meta Conversions API, the TikTok
  Events API or a server-side GTM container, with shared event IDs for
  deduplication, and keep signed consent records.

## Install

```bash
npm install consentlayer
```

Then install the SDK of each provider that needs one (`posthog-js`,
`@sentry/browser`).

## Quick start

```ts
// lib/analytics.ts
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { posthog } from 'consentlayer/providers/posthog'

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: 'G-XXXXXXX' }),
    posthog({ apiKey: 'phc_…' }),
  ],
})
```

In the Next.js App Router, `AnalyticsProvider` from `consentlayer/next` sends a
page view on every navigation. Elsewhere, use the one from `consentlayer/react`
and pass a `routeKey` that changes on navigation.

```tsx
'use client'
import { AnalyticsProvider } from 'consentlayer/next'
import { ConsentBanner } from './consent-banner' // the Consent UI recipe in the docs
import { analytics } from '../lib/analytics'

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider analytics={analytics}>
      <ConsentBanner />
      {children}
    </AnalyticsProvider>
  )
}
```

```ts
analytics.track('sign_up', { method: 'google' })
analytics.identify('user_123', { email: 'ada@example.com' })
```

## Documentation

**[consentlayer.vercel.app](https://consentlayer.vercel.app)**: a setup guide
for each framework, every provider and option, and the server.

## Legal notice

ConsentLayer has not been legally reviewed and is not legal advice. Whether
your implementation complies with the law where you and your visitors are is
your responsibility; see the
[legal notice](https://consentlayer.vercel.app/guides/legal/).

## License

[MIT](./LICENSE)
