---
title: SolidStart
description: Set up ConsentLayer in a SolidStart or Solid Router application with consentlayer/solidstart.
---

This guide sets up ConsentLayer in a SolidStart application: a module-level
analytics instance, a provider in the router's root that holds consent state
for your consent banner, page views on every navigation, event tracking, and
error reporting. `consentlayer/solidstart` exports everything
[`consentlayer/solid`](/start/solid/) does, with an `<AnalyticsProvider>` that
follows Solid Router's navigation itself. It needs only `@solidjs/router`, so
it also works in a Solid application that uses Solid Router without SolidStart.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Create the instance

Create the instance once, at module level, in a file your components import.
SolidStart builds with Vite, so environment variables prefixed with `VITE_` are
available in browser code from `import.meta.env`:

```ts
// src/lib/analytics.ts
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

The options are the same as in React; [React](/start/react/#1-create-the-instance)
explains how missing IDs, `autoTracking`, `enabled` and `debug` behave.

## 2. Add the provider to the router's root

Render `<AnalyticsProvider>` in the `root` of your `<Router>`, where Solid
Router's location is available:

```tsx
// src/app.tsx
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { AnalyticsProvider, ErrorBoundary } from 'consentlayer/solidstart'
import { Suspense } from 'solid-js'
import { analytics } from '~/lib/analytics'
import { ConsentBanner } from '~/lib/ConsentBanner'
import { CookieSettingsButton } from '~/lib/CookieSettingsButton'

export default function App() {
  return (
    <Router
      root={(props) => (
        <AnalyticsProvider analytics={analytics}>
          <ErrorBoundary fallback={<p>Something went wrong.</p>}>
            <Suspense>{props.children}</Suspense>
          </ErrorBoundary>
          <ConsentBanner privacyPolicyUrl="/privacy" />
          <CookieSettingsButton />
        </AnalyticsProvider>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
```

The provider behaves as the [Solid provider](/start/solid/#2-add-the-provider)
and takes the same props except `routeKey`, which it sets from the path and
query string of `useLocation()`. After every navigation to a new path or query
string, it sends a page view and calls `analytics.newPageSession()`; a change to
the hash alone sends nothing.

<details>
<summary>When the page view is sent</summary>

Solid Router updates its location when a navigation starts, and the browser's
URL only when the navigation ends, after the new route's data has loaded. The
provider holds the page view while `useIsRouting()` is `true`, so the page view
carries the new URL.

</details>

## 3. Add the banner

Copy the [Solid consent banner recipe](/guides/consent-ui/#solid) into
`src/lib/ConsentBanner.tsx`, and the cookie settings button from
[Solid](/start/solid/#3-add-the-banner) with its import changed to
`consentlayer/solidstart`. Render both once, in the router's root as above.

<details>
<summary>Meta Pixel without JavaScript</summary>

`<MetaPixelNoscript>` renders Meta's `<noscript>` PageView image,
`https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`, in the HTML
SolidStart renders on the server:

```tsx
import { MetaPixelNoscript } from 'consentlayer/solidstart'

<MetaPixelNoscript pixelId={import.meta.env.VITE_FACEBOOK_PIXEL_ID} enabled />
```

Visitors with JavaScript disabled never see the consent banner, so the image
tracks them without consent. For that reason it renders nothing unless you pass
`enabled`, and nothing while `pixelId` is `undefined` or empty. Other
attributes are passed to the image.

</details>

## 4. Track events

`useAnalytics()` returns the instance from `<AnalyticsProvider>`. Outside
components, import the instance from `src/lib/analytics.ts`.

```tsx
import { useAnalytics } from 'consentlayer/solidstart'

export function SignUpButton() {
  const analytics = useAnalytics()
  return <button onClick={() => analytics.track('sign_up', { method: 'email' })}>Sign up</button>
}
```

`useConsent()` returns an object whose `consent` property is an accessor for
the current consent. [Solid](/start/solid/#4-track-events) describes both, and
[Events and identity](/guides/events/) lists the standard events and what each
provider receives.

## 5. Report errors

Wrap your routes in `ErrorBoundary` from `consentlayer/solidstart`, as in the
root above. It is the [Solid `ErrorBoundary`](/start/solid/#5-report-errors):
when a route throws while rendering, it calls
`captureError(error, { source: 'boundary', tags })` and renders `fallback`.

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.

The [SolidStart example](https://github.com/nicolopadovan/analytics-consent-manager-npm/tree/main/apps/example-solidstart)
in the repository runs this setup.
