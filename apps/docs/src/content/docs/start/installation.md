---
title: Installation
description: Install consentlayer and the SDKs of the providers you use.
---

consentlayer runs in any modern browser and on Node 20+ or an edge runtime.
React 18.3 or 19 is needed only for `consentlayer/react`.

```bash
pnpm add consentlayer
```

npm, Yarn and Bun work the same way (`npm install consentlayer`).

## Provider SDKs

Most providers load their vendor's script from the vendor's CDN, so they need
nothing else. A few use an npm SDK, which is an optional peer dependency:
install it only if you use that provider.

| You use | Also install |
|---|---|
| `consentlayer/react` | `react`, `react-dom` |
| `posthog()` | `posthog-js` |
| `sentry()` | `@sentry/browser` |
| `consentlayer/sentry/server`, `consentlayer/sentry/next` | `@sentry/nextjs` |
| `vercel()` | `@vercel/analytics` |

## Entry points

Import each part from its own entry point, so your bundle contains only what
you use.

| Import from | For |
|---|---|
| `consentlayer` | `createAnalytics`, `definePlugin`, storage helpers and types |
| `consentlayer/react` | `AnalyticsProvider`, the hooks, `ErrorBoundary`, `MetaPixelNoscript` |
| `consentlayer/providers/*` | one module per provider: `ga4`, `meta`, `posthog`, `sentry`, `contentsquare`, `hotjar`, `vercel`, `tiktok`, `shopify` |
| `consentlayer/ecommerce` | `productParams`, `cartParams`, `orderParams` |
| `consentlayer/server` | `createAnalyticsHandler`, `sendServerEvent`, `createConsentHandler` and the consent stores |
| `consentlayer/server/meta`, `consentlayer/server/ga4` | `metaCapi`, `ga4Server` |
| `consentlayer/sentry/server`, `consentlayer/sentry/next` | Sentry for Next.js server code and config |
| `consentlayer/testing` | `checkPlugin`, for testing your own plugins |

Every export is listed in the [API reference](/reference/api/).

## Next steps

- Using Next.js? Follow the [Next.js guide](/start/nextjs/).
- Anything else: create the instance with `createAnalytics()`, then call
  `analytics.consent.bootstrap()` and `analytics.boot()` once at startup.
  `<AnalyticsProvider>` does both for you in React.
