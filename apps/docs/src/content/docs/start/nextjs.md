---
title: Next.js
description: Set up ConsentLayer in a Next.js App Router application.
---

This guide sets up ConsentLayer in the Next.js App Router: a module-level
analytics instance, a client component that provides consent state and renders
your consent banner, page views on every navigation, event tracking, and error
reporting on the client and the server. The
[example app](https://github.com/nicolopadovan/analytics-consent-manager-npm/tree/main/apps/example-next)
in the repository is a complete implementation of this guide, built on
Next.js 16.1 and React 19.1.

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

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID }),
    meta({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID }),
  ],
  autoTracking: true,
})
```

Read each `NEXT_PUBLIC_*` variable by its full, literal name, as above. Next.js
inlines only literal `process.env.NEXT_PUBLIC_X` reads into browser code, so a
destructured or dynamically indexed read is `undefined` in the browser.

A provider whose ID is `undefined` or empty is turned off, so the same code
runs in environments where a variable is not set; with `debug: true` it logs
`[consentlayer] ga4 is off: measurementId is not set.` at boot. A value that is
set but malformed throws when the factory is called, for example
`[consentlayer] Invalid GA4 measurement ID: expected format "G-XXXXXXXX", received "UA-12345".`
A GA4 measurement ID must match `G-` followed by 4 to 16 uppercase letters or
digits; a Meta Pixel ID must be a string of 8 to 20 digits.

`createAnalytics()` loads nothing and sets no cookies; providers start when
`analytics.boot()` runs, which `<AnalyticsProvider>` calls in the next step.
Create one instance per page. The hooks in `consentlayer/react` fall back to
the most recently created instance, and storage keys, globals and DOM events
are shared by the whole page, so creating a second instance with different
[`names`](/guides/names/) logs a warning and the last names win.

<details>
<summary>What <code>autoTracking: true</code> sends</summary>

Auto-tracking starts after boot, once `analytics` consent is granted, and sends
each event to every active provider, or only to the provider IDs listed in
`autoTracking.only`. `true` enables every kind with its defaults; pass an
object to configure or disable each kind.

| Option | Default | Event | Params |
|---|---|---|---|
| `pageViews` | `true` | `consentlayer.page_session_start`, on start and on every route change | `session_id` |
| `clicks` | `{ mode: 'all', attribute: 'data-track' }` | `consentlayer.ui_click`, for clicks on `button`, `[role="button"]`, `a`, `input[type="submit"]` and `input[type="button"]` | `ui_target`, `ui_element`, `ui_id`, `path`, `session_id` |
| `scroll` | `{ thresholds: [25, 50, 75, 100] }` | `consentlayer.scroll_depth`, once per threshold and page session | `depth`, `session_id` |
| `timeOnPage` | `{ intervals: [5, 15, 30, 60, 120] }` | `consentlayer.time_on_page`, after each interval in seconds | `seconds`, `session_id` |

With `clicks: { mode: 'attribute' }`, only elements carrying the attribute
are tracked. `ui_target` is the first non-empty value of the attribute,
`aria-label`, `name` and the first 80 characters of the element's text. The
event names derive from [`names.prefix`](/guides/names/).

</details>

<details>
<summary>Turning analytics off in development</summary>

Pass `enabled` and `debug` from the environment in the same way:

```ts
export const analytics = createAnalytics({
  providers: [/* … */],
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  debug: process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true',
})
```

While `enabled` is `false`, every provider is torn down and calls are dropped,
so development builds send nothing unless you opt in. `debug: true` logs
consent changes, skipped providers and provider errors with `console.debug`.
Earlier versions read these variables with `createEnvConfig`, which is
deprecated: reading `process.env` directly is shorter and keeps each read
literal.

</details>

## 2. Add the provider and the banner

Copy the [consent banner recipe](/guides/consent-ui/) into
`components/consent-banner.tsx`. Then create a client component that wraps
your application in `<AnalyticsProvider>`, renders the banner, and gives
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

`<AnalyticsProvider>` from `consentlayer/next` is the provider from
`consentlayer/react` with the route taken from the App Router: it reads
`usePathname()` and `useSearchParams()` and sends a page view whenever either
changes, so navigating from `/shop` to `/shop?page=2` sends one. It accepts
every prop of the React provider except `routeKey`. The shell still needs
`'use client'` because it renders `CookieSettingsButton`, which calls a hook.

On mount, `<AnalyticsProvider>` performs these steps:

1. It calls `analytics.consent.bootstrap()`, which reads the stored choice from
   `localStorage`, or from your consent adapters if nothing is stored. When
   neither yields a choice, `useConsentController()` reports
   `bannerVisible: true`, unless `autoShowBanner` is `false`.
2. It schedules `analytics.boot()` according to the [`boot`](#boot-timing)
   prop. Boot runs each provider's `setup` and `consent` hooks, and `load` for
   those whose consent requirement is met or that set `loadBeforeConsent`.
3. After boot, it sends a page view to every active provider that has not
   received one for the current route. A provider that becomes active
   later, because the visitor grants its category, receives the current page
   view at that point, so it is not sent twice and not lost.
4. Whenever the route changes, it sends a page view to every active provider
   and calls `analytics.newPageSession()`, which restarts the auto-tracking
   scroll and time counters when auto-tracking is on.

| Prop | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | Required | The instance from `createAnalytics()`. |
| `page` | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details. |
| `boot` | `{ mode?, timeoutMs? }` | `{ mode: 'immediate' }` | When providers start. Read once, on mount. See [Boot timing](#boot-timing). |
| `autoShowBanner` | `boolean` | `true` | Whether `bannerVisible` becomes `true` when there is no stored choice. |
| `openConsentGlobalKey` | `string` | `'CONSENTLAYER_openConsent'` | The `window` function that opens the settings dialog from outside React. |

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

`consentlayer/next` supports the App Router only. In the Pages Router and in
other frameworks, use `<AnalyticsProvider>` from `consentlayer/react` and
pass `routeKey` yourself: any string that changes on navigation, or `null`
while the route is not yet known. See the [API reference](/reference/api/#analyticsprovider).

</details>

## 3. Wrap the layout

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
<summary>Meta Pixel without JavaScript, and Shopify Customer Privacy</summary>

`<MetaPixelNoscript>` from `consentlayer/react` renders Meta's `<noscript>`
PageView image, `https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`,
for visitors with JavaScript disabled. Those visitors never see the consent
banner, so the image tracks them without consent. For that reason it renders
nothing unless you pass `enabled`, and nothing while `pixelId` is `undefined`
or empty, so you can pass the environment variable directly. The example app
enables it with `NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT=true`.

The Shopify Customer Privacy adapter needs Shopify's consent script on the
page. `getShopifyCustomerPrivacyScriptUrl()` from
`consentlayer/providers/shopify` returns its URL, which you load with
`next/script`:

```tsx
// app/layout.tsx
import { MetaPixelNoscript } from 'consentlayer/react'
import { getShopifyCustomerPrivacyScriptUrl } from 'consentlayer/providers/shopify'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { AnalyticsShell } from '../components/analytics-shell'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script src={getShopifyCustomerPrivacyScriptUrl()} strategy="lazyOnload" />
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

In client components, `useAnalytics()` returns the instance from the nearest
`<AnalyticsProvider>`, or the most recently created instance when there is no
provider above it. Anywhere else in browser code, import the instance from
`lib/analytics.ts`.

```tsx
'use client'

import { useAnalytics } from 'consentlayer/react'

export function SignUpButton() {
  const analytics = useAnalytics()
  return <button onClick={() => analytics.track('sign_up', { method: 'email' })}>Sign up</button>
}
```

`track(name, params?, options?)` returns a promise that never rejects because
of a provider: provider failures are passed to the `onError` option of
`createAnalytics()`. Parameters are typed for the standard events, such as
`sign_up` and `purchase`; any other name is sent as a custom event.
`useConsent()` returns the current consent, `null` before a choice, and
re-renders when it changes.

[Events and identity](/guides/events/) lists the standard events, what each
provider receives, and how `identify()` is gated by consent.

## 5. Report errors

Wrap parts of the tree in `ErrorBoundary` from `consentlayer/react`. When a
child throws during rendering, it calls `captureError(error, { source: 'boundary', tags })`
on the instance and renders `fallback`:

```tsx
import { ErrorBoundary } from 'consentlayer/react'

<ErrorBoundary fallback={<p>Could not load the cart.</p>} tags={{ area: 'cart' }}>
  <Cart />
</ErrorBoundary>
```

| Prop | Type | Description |
|---|---|---|
| `fallback` | `ReactNode \| (({ error, reset }) => ReactNode)` | Rendered after an error. `reset()` clears the error and renders the children again. |
| `tags` | `Record<string, string>` | Attached to the reported error. |
| `analytics` | `Analytics` | The instance to report to. Defaults to the one from `<AnalyticsProvider>`, then to the most recently created instance. |

`captureError` delivers errors to the providers that implement error
reporting, Sentry and PostHog, while their consent requirement is met. Add
`sentry({ dsn })` from `consentlayer/providers/sentry` to your providers to
report browser errors to Sentry; it sends errors without consent and without
personal data. Unless you set `errors: { globalHandlers: false }`,
ConsentLayer also reports the window's `error` and `unhandledrejection` events
after boot. `errors: false` disables both.

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

| Option | Type | Default |
|---|---|---|
| `dsn` | `string \| undefined` | Required. `undefined` disables Sentry. |
| `environment` | `string` | Sentry's default |
| `release` | `string` | Sentry's default |
| `tracesSampleRate` | `number` | Tracing off |

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

By default, providers boot as soon as `<AnalyticsProvider>` mounts. To keep
provider setup off the critical rendering path, boot when the browser is idle:

```tsx
<AnalyticsProvider analytics={analytics} boot={{ mode: 'idle', timeoutMs: 3000 }}>
```

| `mode` | Providers boot |
|---|---|
| `'immediate'` (default) | In the provider's mount effect. |
| `'idle'` | In a `requestIdleCallback` callback, with `timeoutMs` (default 3000) as its deadline. Where `requestIdleCallback` is unavailable, after a `setTimeout` of `timeoutMs` (default 1500). |
| `'manual'` | When you call `analytics.boot()`. |

The `boot` prop is read once, on mount; later changes have no effect. Page
views, events, identity calls and errors issued before boot are held, up to
100, and delivered after it. Further calls are dropped and reported once to
`onError` with the scope `queue-full`.

`boot` delays every provider. To delay only one provider's SDK, use that
provider's `defer` option instead; see
Loading SDKs later in [Providers](/guides/providers/).

### Server-side tracking

To also send events to the Meta Conversions API from your server, set
`server.endpoint` and add a route that handles it:

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
`createAnalytics()` throws otherwise. The browser posts each page view and
event to it, with the same event ID it gives the providers, only while
`analytics` or `marketing` is granted. The handler sends an event to Meta only
when its consent grants `marketing`, and answers `204` once the destinations
have been called. [Server-side tracking](/guides/server-side-tracking/) covers
the handler, server-only events and custom destinations, and
[Consent records](/guides/consent-records/) covers the signed consent cookie
that lets the handler ignore the consent reported by the browser.
