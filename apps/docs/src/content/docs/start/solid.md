---
title: Solid
description: Set up ConsentLayer in a SolidJS application with consentlayer/solid.
---

This guide sets up ConsentLayer in a Solid application built with Vite: a
module-level analytics instance, a provider that holds consent state for your
consent banner, page views, event tracking, and error reporting.
`consentlayer/solid` supports Solid 1.9 and later. For SolidStart or Solid
Router, follow [SolidStart](/start/solidstart/) instead.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Create the instance

Create the instance once, at module level, in a file your components import.
Pass each provider its ID from the environment; with Vite, that is
`import.meta.env`:

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

## 2. Add the provider

Wrap your application in `<AnalyticsProvider>`:

```tsx
// src/App.tsx
import { AnalyticsProvider } from 'consentlayer/solid'
import { analytics } from './lib/analytics'
import { ConsentBanner } from './lib/ConsentBanner'
import { CookieSettingsButton } from './lib/CookieSettingsButton'
import { Page } from './Page'

export function App() {
  return (
    <AnalyticsProvider analytics={analytics}>
      <Page />
      <ConsentBanner privacyPolicyUrl="/privacy" />
      <CookieSettingsButton />
    </AnalyticsProvider>
  )
}
```

Once the provider is mounted, it performs these steps:

1. It calls `analytics.consent.bootstrap()`, which reads the stored choice from
   `localStorage`, or from your consent adapters if nothing is stored. When
   neither yields a choice, `bannerVisible` becomes `true`, unless
   `autoShowBanner` is `false`.
2. It schedules `analytics.boot()` according to the
   [`boot`](/start/react/#boot-timing) prop.
3. It sends a page view to every active provider. A provider that becomes
   active later, because the visitor grants its category, receives the current
   page view at that point.
4. Whenever `routeKey` changes, it sends a page view and calls
   `analytics.newPageSession()`.

When the provider is disposed, it stops. On the server it does nothing, and
`ready` stays `false`, so the banner is not rendered there and the HTML matches
the first render in the browser.

The props are those of the [React provider](/start/react/#2-add-the-provider-and-the-banner).
`routeKey` is read reactively, so pass it a signal's value, such as
`routeKey={location.pathname}`; the other props are read once, when the
provider is created. Without `routeKey`, it sends one page view for the page
load.

## 3. Add the banner

Copy the [Solid consent banner recipe](/guides/consent-ui/#solid) into
`src/lib/ConsentBanner.tsx`, change its import to `consentlayer/solid`, and
render it once, inside the provider as above. A button to reopen the settings
reads the same state:

```tsx
// src/lib/CookieSettingsButton.tsx
import { useConsentController } from 'consentlayer/solid'
import { Show } from 'solid-js'

export function CookieSettingsButton() {
  const consent = useConsentController()

  return (
    <Show when={consent.ready && !consent.bannerVisible}>
      <button type="button" onClick={() => consent.openDialog()}>
        Cookie settings
      </button>
    </Show>
  )
}
```

`useConsentController()` returns the state as reactive properties: read
`consent.bannerVisible` in JSX or an effect, since destructuring it reads the
value once. It throws when no `<AnalyticsProvider>` is above the component.

<details>
<summary>Meta Pixel without JavaScript</summary>

`<MetaPixelNoscript>` renders Meta's `<noscript>` PageView image,
`https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`, for visitors
with JavaScript disabled:

```tsx
import { MetaPixelNoscript } from 'consentlayer/solid'

<MetaPixelNoscript pixelId={import.meta.env.VITE_FACEBOOK_PIXEL_ID} enabled />
```

Those visitors never see the consent banner, so the image tracks them without
consent. For that reason it renders nothing unless you pass `enabled`, and
nothing while `pixelId` is `undefined` or empty. Other attributes are passed to
the image. It only has an effect in HTML rendered on the server, as with
SolidStart or `renderToString` from `solid-js/web`; an application rendered
only in the browser never shows it.

</details>

## 4. Track events

`useAnalytics()` returns the instance from the nearest `<AnalyticsProvider>`,
or the most recently created instance when there is no provider above it.
Outside components, import the instance from `src/lib/analytics.ts`.

```tsx
import { useAnalytics } from 'consentlayer/solid'

export function SignUpButton() {
  const analytics = useAnalytics()
  return <button onClick={() => analytics.track('sign_up', { method: 'email' })}>Sign up</button>
}
```

`useConsent()` returns an object whose `consent` property is an accessor:
`consent()` is the current consent, `null` before a choice, and updates when
it changes. [Events and identity](/guides/events/) lists the standard events
and what each provider receives.

## 5. Report errors

`ErrorBoundary` from `consentlayer/solid` wraps Solid's `<ErrorBoundary>`.
When a child throws while rendering or in an effect, it calls
`captureError(error, { source: 'boundary', tags })` on the instance and renders
`fallback`:

```tsx
import { ErrorBoundary } from 'consentlayer/solid'

<ErrorBoundary fallback={(error, reset) => <button onClick={reset}>Retry</button>} tags={{ area: 'cart' }}>
  <Cart />
</ErrorBoundary>
```

As with Solid's own boundary, `fallback` is an element or a function of the
error and `reset`, and errors thrown in event handlers are not caught. The
`analytics` prop overrides the instance it reports to.

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.
