---
title: Next.js
description: Set up ConsentLayer in a Next.js App Router application.
---

This guide sets up ConsentLayer in the Next.js App Router: a module-level
analytics instance, a client component that provides consent state and renders
your consent banner, page views on every navigation, event tracking, and error
reporting on the client and the server. The
[example app](https://github.com/nicolopadovan/consentlayer/tree/main/apps/example-next)
in the repository is a complete implementation of this guide, built on
Next.js 16.1 and React 19.1.

Next.js uses the React binding, `consentlayer/react`, plus `consentlayer/next`
for the router. This page covers what is specific to Next.js; the
[React](/start/react/) guide describes the provider, the hooks and the error
boundary in full.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Create the instance

Create the instance once, at module level, in a file that client components
import. Pass each provider its ID straight from the environment:

```ts
// lib/analytics.ts
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'
import { autoTracking } from 'consentlayer/auto-tracking'

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID }),
    meta({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID }),
  ],
  autoTracking: autoTracking(),
})
```

Read each `NEXT_PUBLIC_*` variable by its full, literal name, as above. Next.js
inlines only literal `process.env.NEXT_PUBLIC_X` reads into browser code, so a
destructured or dynamically indexed read is `undefined` in the browser.

A provider whose ID is not set is turned off, so the same code runs in every
environment. [Create the instance](/start/react/#1-create-the-instance) in the
React guide covers ID validation, `autoTracking` and turning analytics off in
development.

## 2. Add the provider

Create a client component that wraps your application in
`<AnalyticsProvider>`:

```tsx
// components/analytics-shell.tsx
'use client'

import { AnalyticsProvider } from 'consentlayer/next'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'

export function AnalyticsShell({ children }: { children: ReactNode }) {
  return <AnalyticsProvider analytics={analytics}>{children}</AnalyticsProvider>
}
```

`<AnalyticsProvider>` from `consentlayer/next` is the provider from
`consentlayer/react` with the route taken from the App Router: it reads
`usePathname()` and `useSearchParams()` and sends a page view whenever either
changes, so navigating from `/shop` to `/shop?page=2` sends one. It accepts
every prop of the React provider except `routeKey`. The shell is a client
component because `analytics` holds functions, which a Server Component cannot
pass to a client component.

On mount, it bootstraps consent, boots the providers and sends the first page
view, as described in [Add the
provider](/start/react/#2-add-the-provider); that section also lists its
props.

Render the shell in the root layout. No `<Suspense>` boundary is needed:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react'
import { AnalyticsShell } from '../components/analytics-shell'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsShell>{children}</AnalyticsShell>
      </body>
    </html>
  )
}
```

<details>
<summary>Why there is no <code>&lt;Suspense&gt;</code> around your pages</summary>

During static rendering, `useSearchParams()` makes the nearest `<Suspense>`
boundary above it render only on the client. The usual pattern, a shell that
calls `useSearchParams()` wrapped in `<Suspense fallback={null}>` in the root
layout, therefore moves every page into that boundary: the prerendered HTML
contains the fallback instead of the page. `consentlayer/next` calls
`useSearchParams()` in an internal component that renders nothing, inside its
own `<Suspense>` boundary, so only that component waits for the client and
your pages are prerendered as usual. Page views are held until it reports the
first route, so the first page is not counted twice.

`consentlayer/next` also works in the Pages Router: render the same
`<AnalyticsProvider>` in `pages/_app.tsx`. There, page views are held until
`router.isReady`, so a statically optimized page that hydrates without its
query string is counted once, with the full URL. In other frameworks, use
`<AnalyticsProvider>` from `consentlayer/react` and pass `routeKey` yourself:
any string that changes on navigation, or `null` while the route is not yet
known, as the [React](/start/react/) guide shows.

</details>

## 3. Add the banner

Copy the [consent banner recipe](/guides/consent-ui/) into
`components/consent-banner.tsx`. Then render the banner in the shell, and give
visitors a way to reopen their settings:

```tsx
// components/analytics-shell.tsx
'use client'

import { AnalyticsProvider } from 'consentlayer/next'
import { useConsentController } from 'consentlayer/react'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'
import { ConsentBanner } from './consent-banner'

function CookieSettingsButton() {
  const { openDialog, bannerVisible } = useConsentController()
  if (bannerVisible) return null
  return (
    <button type="button" onClick={openDialog}>
      Cookie settings
    </button>
  )
}

export function AnalyticsShell({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider analytics={analytics}>
      <ConsentBanner privacyPolicyUrl="/privacy" />
      <CookieSettingsButton />
      {children}
    </AnalyticsProvider>
  )
}
```

`useConsentController()` comes from `consentlayer/react` and returns the state
and actions that `<AnalyticsProvider>` holds; `bannerVisible` is also `true`
when the stored choice is [stale](/guides/consent-ui/#asking-again), unless
you pass `autoShowBanner={false}`.

<details>
<summary>Meta Pixel and GTM without JavaScript, and Shopify Customer Privacy</summary>

`<MetaPixelNoscript>` from `consentlayer/react` renders Meta's `<noscript>`
PageView image, `https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`,
for visitors with JavaScript disabled. Those visitors never see the consent
banner, so the image tracks them without consent. For that reason it renders
nothing unless you pass `enabled`, and nothing while `pixelId` is `undefined`
or empty, so you can pass the environment variable directly. The example app
enables it with `NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT=true`.

`<GtmNoscript containerId={…} enabled />` from `consentlayer/react` does the
same for Google Tag Manager's `<noscript>` iframe; see
[Google Tag Manager](/guides/providers/gtm/#without-javascript).

On a headless Shopify storefront, the Shopify Customer Privacy adapter loads
Shopify's consent script itself once `storefrontAccessToken` is set, so the
layout needs no `<Script>` for it:

```tsx
// app/layout.tsx
import { MetaPixelNoscript } from 'consentlayer/react'
import type { ReactNode } from 'react'
import { AnalyticsShell } from '../components/analytics-shell'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MetaPixelNoscript
          enabled={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT === 'true'}
          pixelId={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID}
        />
        <AnalyticsShell>{children}</AnalyticsShell>
      </body>
    </html>
  )
}
```

The root layout is a Server Component, so these reads use the server's
environment at render time. Configure the adapter itself as described in
[Providers](/guides/providers/).

</details>

## 4. Track events

In client components, use `useAnalytics()` and `useConsent()` from
`consentlayer/react`, as described in [Track
events](/start/react/#4-track-events). Anywhere else in browser code, import
the instance from `lib/analytics.ts`.

## 5. Report errors

In client components, wrap parts of the tree in `ErrorBoundary` from
`consentlayer/react`, as described in [Report
errors](/start/react/#5-report-errors). Two Next.js files cover the rest.

### Global errors

`app/global-error.tsx` replaces the root layout when the layout itself throws,
so `<AnalyticsProvider>` is not mounted. `createGlobalError(analytics)` returns
a component for that file which bootstraps consent, boots the instance, and
reports the error with `level: 'fatal'` and Next.js's `digest` as a tag:

```tsx
// app/global-error.tsx
'use client'

import { createGlobalError } from 'consentlayer/react'
import { analytics } from '../lib/analytics'

export default createGlobalError(analytics)
```

The default page shows "Something went wrong." and a "Try again" button that
calls `reset`. To render your own page, pass a second argument of type
`({ error, reset }) => ReactNode`; its output is rendered inside
`<html lang="en"><body>`.

### Server errors

To report errors thrown on the server, register Sentry in
`instrumentation.ts`:

```ts
// instrumentation.ts
import { sentryInstrumentation } from 'consentlayer/sentry/server'

export const { register, onRequestError } = sentryInstrumentation({ dsn: process.env.SENTRY_DSN })
```

`register` initializes `@sentry/nextjs` with user info, cookies, HTTP headers,
request bodies and URL query parameters excluded, and does nothing when `dsn`
is `undefined`. `onRequestError` is `@sentry/nextjs`'s `captureRequestError`.
Server errors are not gated by consent, since they carry no personal data.

| Option             | Type                  | Default                                |
| ------------------ | --------------------- | -------------------------------------- |
| `dsn`              | `string \| undefined` | Required. `undefined` disables Sentry. |
| `environment`      | `string`              | Sentry's default                       |
| `release`          | `string`              | Sentry's default                       |
| `tracesSampleRate` | `number`              | Tracing off                            |

Then wrap your Next.js configuration with `withSentryConfig`, which
`consentlayer/sentry/next` re-exports unchanged from `@sentry/nextjs/config`.
Pass it `org`, `project` and `authToken` to upload source maps.

```ts
// next.config.ts
import { withSentryConfig } from 'consentlayer/sentry/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default withSentryConfig(nextConfig, { silent: true })
```

## Options

### Boot timing

`<AnalyticsProvider>` from `consentlayer/next` takes the same `boot` prop as
the React provider; see [Boot timing](/start/react/#boot-timing).

### Server-side tracking

To also forward events from your server to the Meta Conversions API, the
TikTok Events API or a server-side GTM container, set `server.endpoint` and add
a route that handles it. This example forwards to Meta:

```ts
// lib/analytics.ts
export const analytics = createAnalytics({
  providers,
  server: { endpoint: '/api/analytics' },
})
```

```ts
// app/api/analytics/route.ts
import { createAnalyticsHandler } from 'consentlayer/server'
import { metaCapi } from 'consentlayer/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [
    metaCapi({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID, accessToken: process.env.META_TOKEN }),
  ],
  onError: console.error,
})
```

`metaCapi()` returns `undefined` while `pixelId` or `accessToken` is unset, and
the handler skips `undefined` destinations, so the route answers `204` and
sends nothing in environments without the token.

`server.endpoint` must be an HTTPS URL or a path starting with `/`;
`createAnalytics()` throws otherwise, while `undefined` or `''` turns
forwarding off. The browser posts each page view and event to it, with the
same event ID it gives the providers, only while `analytics` or `marketing` is
granted. The handler sends an event to a destination only when its consent
grants the destination's category: `marketing` for Meta and TikTok,
`analytics` for server-side GTM. It answers `204` once the destinations have
been called. [Server-side tracking](/guides/server-side-tracking/) covers
the handler, server-only events and custom destinations, and
[Consent records](/guides/consent-records/) covers the signed consent cookie
that lets the handler ignore the consent reported by the browser.
