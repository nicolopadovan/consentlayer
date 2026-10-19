---
title: React & TanStack Start
description: Set up ConsentLayer in a React or TanStack Start application with consentlayer/react and consentlayer/tanstack-start.
---

This guide sets up ConsentLayer in a React application without Next.js, such
as one built with Vite or React Router: a module-level analytics instance, a
provider that holds consent state and renders your consent banner, page views
on every navigation, event tracking, and error reporting. `consentlayer/react`
supports React 18.3 and 19. For Next.js, follow the [Next.js](/start/nextjs/)
guide, which builds on this one. For TanStack Start or TanStack Router, follow
the same steps with the provider from `consentlayer/tanstack-start`, as
[TanStack Start](#tanstack-start) describes.

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
import { autoTracking } from 'consentlayer/auto-tracking'

export const analytics = createAnalytics({
  providers: [
    ga4({ measurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID }),
    meta({ pixelId: import.meta.env.VITE_FACEBOOK_PIXEL_ID }),
  ],
  autoTracking: autoTracking(),
})
```

A provider whose ID is `undefined`, empty or only whitespace is turned off, so
the same code runs in environments where a variable is not set. With
`debug: true`, it logs `[consentlayer] ga4 is off: measurementId is not set.`
when `createAnalytics()` creates the instance. Surrounding whitespace, such as
a trailing newline in a `.env` file, is trimmed first.

`ga4()`, `meta()`, `gtm()` and `hotjar()` throw when their factory is called
with an ID that is set but malformed, for example
`[consentlayer] Invalid GA4 measurement ID: expected format "G-XXXXXXXX", received "UA-12345".`
A GA4 measurement ID must match `G-` followed by 4 to 16 uppercase letters or
digits, a Meta Pixel ID must be a string of 8 to 20 digits, a GTM container ID
must match `GTM-` followed by 4 to 12 uppercase letters or digits, and a
Hotjar `siteId` and `version` must each be a positive integer, as a number or a
string of digits. The other providers do not check the format of their IDs.

`createAnalytics()` loads nothing and sets no cookies; providers start when
`analytics.boot()` runs, which `<AnalyticsProvider>` calls in the next step.
Create one instance per page. The hooks in `consentlayer/react` fall back to
the most recently created instance, and storage keys, globals and DOM events
are shared by the whole page, so creating a second instance with different
[`names`](/guides/names/) logs a warning and the last names win.

[Auto-tracking](/guides/auto-tracking/) describes the events `autoTracking()`
sends and its options.

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
consent changes, page views and events per provider, provider lifecycle and
errors with `console.debug`; [`debug`](/reference/api/#debug) narrows it.

</details>

## 2. Add the provider

Wrap your application in `<AnalyticsProvider>`. Pass `routeKey` a string that
changes on every navigation; with React Router, the path and query string from
`useLocation()`:

```tsx
// src/analytics-shell.tsx
import { AnalyticsProvider } from 'consentlayer/react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { analytics } from './analytics'

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation()
  return (
    <AnalyticsProvider analytics={analytics} routeKey={pathname + search}>
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
   neither yields a choice, or the stored choice is
   [stale](/guides/consent-ui/#asking-again), `useConsentController()` reports
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

| Prop                   | Type                      | Default                         | Description                                                                                                                              |
| ---------------------- | ------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `analytics`            | `Analytics`               | Required                        | The instance from `createAnalytics()`.                                                                                                   |
| `routeKey`             | `string \| null`          | `'default'`                     | Changes on every navigation; a page view is sent once per value. `null` holds page views until the route is known.                       |
| `page`                 | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details.                                                                                                       |
| `boot`                 | `{ mode?, timeoutMs? }`   | `{ mode: 'immediate' }`         | When providers start. Read once, on mount. See [Boot timing](#boot-timing).                                                              |
| `autoShowBanner`       | `boolean`                 | `true`                          | Whether `bannerVisible` becomes `true` when there is no stored choice or the stored choice is [stale](/guides/consent-ui/#asking-again). |
| `openConsentGlobalKey` | `string`                  | `'CONSENTLAYER_openConsent'`    | The `window` function that opens the settings dialog from outside React.                                                                 |

## 3. Add the banner

To use the ready-made banner instead, render [`<ConsentBanner>`](/guides/banner/#react-and-nextjs)
from `consentlayer/react/banner` inside the provider; the rest of this step builds your own.

Copy the [consent banner recipe](/guides/consent-ui/) into
`src/consent-banner.tsx`. Then render the banner inside the provider, and give
visitors a way to reopen their settings:

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

`useConsentController()` returns the banner's state and actions. It throws when
there is no `<AnalyticsProvider>` above it.

<details>
<summary>Meta Pixel and GTM without JavaScript</summary>

`<MetaPixelNoscript>` from `consentlayer/react` renders Meta's `<noscript>`
PageView image, `https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`,
for visitors with JavaScript disabled. Those visitors never see the consent
banner, so the image tracks them without consent. For that reason it renders
nothing unless you pass `enabled`, and nothing while `pixelId` is `undefined`
or empty, so you can pass the environment variable directly. It only has an
effect in HTML rendered on the server; an application rendered only in the
browser never shows it.

`<GtmNoscript containerId={…} enabled />` from `consentlayer/react` does the
same for Google Tag Manager's `<noscript>` iframe; see
[Google Tag Manager](/guides/providers/gtm/#without-javascript).

</details>

## 4. Track events

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
`sign_up` and `purchase`; any other name is sent as a custom event. To
type your own events and reject misspelled names, declare them in
`src/analytics.ts`, as [Typed custom events](/guides/events/#typed-custom-events)
shows. The Meta and TikTok pixels receive only standard events unless you
[list others](/guides/events/#routing-events).

`useConsent()` returns `{ consent, engine, setConsent, update }`. `consent` is
the current consent, `null` before a choice, and the component re-renders when
it changes. `engine` is `analytics.consent`; `setConsent(consent)` saves a
complete choice and `update(partial)` merges a partial one into the current
consent.

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

| Prop        | Type                                             | Description                                                                                                            |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `fallback`  | `ReactNode \| (({ error, reset }) => ReactNode)` | Rendered after an error. `reset()` clears the error and renders the children again.                                    |
| `tags`      | `Record<string, string>`                         | Attached to the reported error.                                                                                        |
| `analytics` | `Analytics`                                      | The instance to report to. Defaults to the one from `<AnalyticsProvider>`, then to the most recently created instance. |

In a React 18 development build, an error thrown while rendering is reported
up to three times: React replays the failed render and rethrows a new error
object through the window, which the global handlers report with `source:
'global'`, before the boundary reports it with `source: 'boundary'`. React 18
production builds and React 19 report it once, from the boundary.

`captureError` delivers errors to the providers that implement error
reporting, Sentry and PostHog, while their consent requirement is met. Add
`sentry({ dsn })` from `consentlayer/providers/sentry` to your providers to
report browser errors to Sentry; it sends errors without consent and without
personal data. Unless you set `errors: { globalHandlers: false }`,
ConsentLayer also reports the window's `error` and `unhandledrejection` events
after boot. `errors: false` disables both.

## TanStack Start

`consentlayer/tanstack-start` exports an `<AnalyticsProvider>` that follows
TanStack Router's navigation itself, so it takes every prop in the
[table above](#2-add-the-provider) except `routeKey`. It needs
`@tanstack/react-router` 1.29 or later, which TanStack Start installs, so it
also works in an application that uses TanStack Router without TanStack Start.
The hooks and components, such as `useConsentController()`, `useAnalytics()`
and `ErrorBoundary`, come from `consentlayer/react`.

Render the provider in the root route, around `<Outlet />`, with the banner
inside it:

```tsx
// src/routes/__root.tsx
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { useConsentController } from 'consentlayer/react'
import { AnalyticsProvider } from 'consentlayer/tanstack-start'
import type { ReactNode } from 'react'
import { analytics } from '../analytics'
import { ConsentBanner } from '../consent-banner'

export const Route = createRootRoute({
  shellComponent: RootDocument,
  component: Root,
})

function CookieSettingsButton() {
  const { openDialog, bannerVisible } = useConsentController()
  if (bannerVisible) return null
  return (
    <button type="button" onClick={openDialog}>
      Cookie settings
    </button>
  )
}

function Root() {
  return (
    <AnalyticsProvider analytics={analytics}>
      <Outlet />
      <ConsentBanner privacyPolicyUrl="/privacy" />
      <CookieSettingsButton />
    </AnalyticsProvider>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

The provider's route key is the path and query string of the router's
resolved location, the location whose loaders and transition have settled.
A navigation therefore sends its page view once the new route's loaders have
resolved and the new page has rendered, so the page view carries the new
page's URL and the `title` from its `head`. A navigation that changes only the
query string sends a page view too. Until the router resolves its first
location, page views are held.

The [TanStack Start example](https://github.com/nicolopadovan/consentlayer/tree/main/apps/example-tanstack-start)
in the repository runs this setup.

## Options

### Boot timing

By default, providers boot as soon as `<AnalyticsProvider>` mounts. To keep
provider setup off the critical rendering path, boot when the browser is idle:

```tsx
<AnalyticsProvider analytics={analytics} boot={{ mode: 'idle', timeoutMs: 3000 }}>
```

| `mode`                  | Providers boot                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'immediate'` (default) | In the provider's mount effect.                                                                                                                                                       |
| `'idle'`                | In a `requestIdleCallback` callback, with `timeoutMs` (default 3000) as its deadline. Where `requestIdleCallback` is unavailable, after a `setTimeout` of `timeoutMs` (default 1500). |
| `'manual'`              | When you call `analytics.boot()`.                                                                                                                                                     |

The `boot` prop is read once, on mount; later changes have no effect. Page
views, events, identity calls and errors issued before boot are held, up to
100, and delivered after it. Further calls are dropped and reported once to
`onError` with the scope `queue-full`.

`boot` delays every provider. To delay only one provider's SDK, use that
provider's `defer` option instead; see
Loading SDKs later in [Providers](/guides/providers/).

### Server-side tracking

To also forward events to the Meta Conversions API, the TikTok Events API or a
server-side GTM container, set `server.endpoint` to a route on your backend
and handle it with `createAnalyticsHandler()` from `consentlayer/server`. The
handler takes a standard `Request` and returns a `Response`, so it runs in any
server that uses the Fetch API. [Server-side tracking](/guides/server-side-tracking/)
covers the setup.
