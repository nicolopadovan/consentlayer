---
title: React
description: Set up ConsentLayer in a React application with consentlayer/react.
---

This guide sets up ConsentLayer in a React application without Next.js, such
as one built with Vite or React Router: a module-level analytics instance, a
provider that holds consent state and renders your consent banner, page views
on every navigation, event tracking, and error reporting. `consentlayer/react`
supports React 18.3 and 19. For Next.js, follow the [Next.js](/start/nextjs/)
guide, which builds on this one.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Create the instance

Create the instance once, at module level, in a file your components import.
Pass each provider its ID from the environment; with Vite, that is
`import.meta.env`:

```ts
// src/analytics.ts
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID }),
    meta({ pixelId: import.meta.env.VITE_FACEBOOK_PIXEL_ID }),
  ],
  autoTracking: true,
})
```

A provider whose ID is `undefined`, empty or only whitespace is turned off, so
the same code runs in environments where a variable is not set; with `debug: true` it logs
`[consentlayer] ga4 is off: measurementId is not set.` at boot. A value that is
set but malformed throws when the factory is called; surrounding whitespace,
such as a trailing newline in a `.env` file, is trimmed first. For example
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
  enabled: import.meta.env.PROD || import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  debug: import.meta.env.VITE_ANALYTICS_DEBUG === 'true',
})
```

While `enabled` is `false`, every provider is torn down and calls are dropped,
so development builds send nothing unless you opt in. `debug: true` logs
consent changes, skipped providers and provider errors with `console.debug`.

</details>

## 2. Add the provider and the banner

Copy the [consent banner recipe](/guides/consent-ui/) into
`src/consent-banner.tsx`. Then wrap your application in `<AnalyticsProvider>`,
render the banner, and give visitors a way to reopen their settings. Pass
`routeKey` a string that changes on every navigation; with React Router, the
path and query string from `useLocation()`:

```tsx
// src/analytics-shell.tsx
import { AnalyticsProvider, useConsentController } from 'consentlayer/react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { analytics } from './analytics'
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
  const { pathname, search } = useLocation()
  return (
    <AnalyticsProvider analytics={analytics} routeKey={pathname + search}>
      <ConsentBanner privacyPolicyUrl="/privacy" />
      <CookieSettingsButton />
      {children}
    </AnalyticsProvider>
  )
}
```

Render the shell inside your router, around your routes. `useLocation()` only
works below the router. Without a router, omit `routeKey`: the provider sends
one page view for the page load.

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
4. Whenever `routeKey` changes, it sends a page view to every active provider
   and calls `analytics.newPageSession()`, which restarts the auto-tracking
   scroll and time counters when auto-tracking is on.

| Prop | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | Required | The instance from `createAnalytics()`. |
| `routeKey` | `string \| null` | `'default'` | Changes on every navigation; a page view is sent once per value. `null` holds page views until the route is known. |
| `page` | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details. |
| `boot` | `{ mode?, timeoutMs? }` | `{ mode: 'immediate' }` | When providers start. Read once, on mount. See [Boot timing](#boot-timing). |
| `autoShowBanner` | `boolean` | `true` | Whether `bannerVisible` becomes `true` when there is no stored choice. |
| `openConsentGlobalKey` | `string` | `'CONSENTLAYER_openConsent'` | The `window` function that opens the settings dialog from outside React. |

<details>
<summary>Meta Pixel without JavaScript</summary>

`<MetaPixelNoscript>` from `consentlayer/react` renders Meta's `<noscript>`
PageView image, `https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`,
for visitors with JavaScript disabled. Those visitors never see the consent
banner, so the image tracks them without consent. For that reason it renders
nothing unless you pass `enabled`, and nothing while `pixelId` is `undefined`
or empty, so you can pass the environment variable directly. It only has an
effect in HTML rendered on the server; an application rendered only in the
browser never shows it.

</details>

## 3. Track events

`useAnalytics()` returns the instance from the nearest `<AnalyticsProvider>`,
or the most recently created instance when there is no provider above it.
Outside components, import the instance from `src/analytics.ts`.

```tsx
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

## 4. Report errors

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

To also send events to the Meta Conversions API or GA4 from your server, set
`server.endpoint` to a route on your backend and handle it with
`createAnalyticsHandler()` from `consentlayer/server`. The handler takes a
standard `Request` and returns a `Response`, so it runs in any server that
uses the Fetch API. [Server-side tracking](/guides/server-side-tracking/)
covers the setup.
