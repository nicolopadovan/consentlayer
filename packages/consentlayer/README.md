# consentlayer

Consent-first analytics for the browser and the server. You call one API;
consentlayer decides, from the visitor's consent, which providers load, what
each one receives and when, and translates your events into each provider's
format.

- **Providers:** GA4, Meta Pixel and Conversions API, PostHog, Sentry, Hotjar,
  Shopify, Vercel Analytics, and your own plugins.
- **Consent:** three categories (preferences, analytics, marketing). A provider
  loads only once its category is granted (or loads in its vendor's consent
  mode), stops on withdrawal. Email and phone reach providers only with marketing consent.
- **Light:** each provider and each heavy feature (Replay, tracing, session
  recording) is a separate chunk loaded only when used; any provider can defer
  loading until the browser is idle or the first interaction.
- **React and Next.js:** a provider, hooks, an unstyled cookie banner and
  dialog, an error boundary and a `global-error` page.
- **Server:** one route forwards browser events to Meta CAPI with shared event
  IDs for deduplication.

## Install

```bash
npm install consentlayer
```

Then install the SDK of each provider you use (`posthog-js`,
`@sentry/browser`), and `react` for the React parts.

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

```tsx
'use client'
import { AnalyticsProvider } from 'consentlayer/react'
import { CookieBanner, CookieDialog } from 'consentlayer/ui'
import { analytics } from '../lib/analytics'

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider analytics={analytics}>
      <CookieBanner />
      <CookieDialog />
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

**[consentlayer.vercel.app](https://consentlayer.vercel.app)**: concepts, the
lifecycle of each provider, every option, and guides for Next.js and the server.

## License

MIT
