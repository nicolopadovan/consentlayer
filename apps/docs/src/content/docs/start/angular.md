---
title: Angular
description: Set up ConsentLayer in an Angular application with consentlayer/angular.
---

This guide sets up ConsentLayer in an Angular application: a module-level
analytics instance, providers that hold consent state for your consent banner,
page views on every Angular Router navigation, event tracking, and error
reporting. `consentlayer/angular` supports Angular 20 and later, with or
without server-side rendering.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Create the instance

Create the instance once, at module level, in a file your application config
imports. Angular has no `import.meta.env`; the Angular CLI's convention for
build-time values is an environment file, such as
`src/environments/environment.ts`:

```ts
// src/app/analytics.ts
import { isDevMode } from '@angular/core'
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'
import { environment } from '../environments/environment'
import { autoTracking } from 'consentlayer/auto-tracking'

export const analytics = createAnalytics({
  providers: [ga4({ measurementId: environment.ga4MeasurementId }), meta({ pixelId: environment.facebookPixelId })],
  autoTracking: autoTracking(),
  enabled: !isDevMode(),
})
```

The options are the same as in React; [React](/start/react/#1-create-the-instance)
explains how missing IDs, `autoTracking`, `enabled` and `debug` behave.

## 2. Add the providers

Add `provideConsentLayer()` to your application config, after
`provideRouter()`:

```ts
// src/app/app.config.ts
import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideClientHydration } from '@angular/platform-browser'
import { provideRouter } from '@angular/router'
import { provideConsentLayer } from 'consentlayer/angular'
import { analytics } from './analytics'
import { routes } from './app.routes'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideConsentLayer({ analytics }),
  ],
}
```

In the browser, `provideConsentLayer()` performs these steps:

1. Once the application is stable, after hydration when the page was rendered
   on the server, it calls `analytics.consent.bootstrap()`, which reads the
   stored choice from `localStorage`, or from your consent adapters if nothing
   is stored. When neither yields a choice, or the stored choice is
   [stale](/guides/consent-ui/#asking-again), `bannerVisible()` becomes `true`,
   unless `autoShowBanner` is `false`.
2. It schedules `analytics.boot()` according to the
   [`boot`](/start/react/#boot-timing) option.
3. On every `NavigationEnd` to a new path or query string, it sends a page view
   and calls `analytics.newPageSession()`. A change to the hash alone sends
   nothing. Without the Angular Router, it sends one page view for the page
   load.
4. It replaces Angular's `ErrorHandler` with one that sends each error through
   `captureError` with `source: 'boundary'`, then logs it as Angular's default
   handler does. Pass `captureErrors: false` to keep your own `ErrorHandler`.

On the server it only provides the instance and the state: `ready()` stays
`false`, so the banner is not rendered there and the HTML matches the first
render in the browser.

The other options are the props of the
[React provider](/start/react/#2-add-the-provider): `boot`,
`autoShowBanner`, `openConsentGlobalKey` and `page`.

<details>
<summary>When the page view is sent</summary>

The Angular Router updates the browser's URL before `NavigationEnd` and sets
the page title from the route's `title` right after it. The page view is sent
in a microtask after `NavigationEnd`, so it carries both the new URL and the
new title.

</details>

## 3. Add the banner

Copy the [Angular consent banner recipe](/guides/consent-ui/#angular) into
`src/app/consent-banner.ts`, and render `<app-consent-banner />` once, in your
root component. A button to reopen the settings reads the same state:

```ts
// src/app/app.ts
import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { injectConsentController } from 'consentlayer/angular'
import { ConsentBanner } from './consent-banner'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConsentBanner],
  template: `
    <router-outlet />
    <app-consent-banner privacyPolicyUrl="/privacy" />
    @if (consent.ready() && !consent.bannerVisible()) {
      <button type="button" (click)="consent.openDialog()">Cookie settings</button>
    }
  `,
})
export class App {
  protected readonly consent = injectConsentController()
}
```

`injectConsentController()` returns the state as signals, `ready()`,
`error()`, `bannerVisible()`, `dialogVisible()`, `categories()`, `gpc()` and
`prefs()`, and the actions as functions. Call it in an injection context, such as a field
initializer. It throws when `provideConsentLayer()` is not in the application
config.

<details>
<summary>Meta Pixel and GTM without JavaScript</summary>

`provideMetaPixelNoscript()` adds Meta's `<noscript>` PageView image,
`https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`, to the end
of `<body>` in the HTML Angular renders on the server:

```ts
import { provideMetaPixelNoscript } from 'consentlayer/angular'

provideMetaPixelNoscript({ pixelId: environment.facebookPixelId, enabled: true })
```

Visitors with JavaScript disabled never see the consent banner, so the image
tracks them without consent. For that reason it adds nothing unless you pass
`enabled`, and nothing while `pixelId` is `undefined` or empty. Other options
become attributes of the image. It is a provider rather than a component
because Angular components need the Angular compiler, which ConsentLayer's
build doesn't run. An application rendered only in the browser never shows it.

`provideGtmNoscript({ containerId, enabled: true })` does the
same for Google Tag Manager's `<noscript>` iframe; see
[Google Tag Manager](/guides/providers/gtm/#without-javascript).

</details>

## 4. Track events

`injectAnalytics()` returns the instance from `provideConsentLayer()`, or the
most recently created instance when there is none. Outside injection contexts,
import the instance from `src/app/analytics.ts`.

```ts
import { Component } from '@angular/core'
import { injectAnalytics } from 'consentlayer/angular'

@Component({
  selector: 'app-sign-up',
  template: `<button (click)="analytics.track('sign_up', { method: 'email' })">Sign up</button>`,
})
export class SignUp {
  protected readonly analytics = injectAnalytics()
}
```

`injectConsent()` returns `{ consent, engine, setConsent, update }`. `consent`
is a read-only signal: `consent()` is the current consent, `null` before a
choice, and updates when it changes. Call it in an injection context. `engine`
is `analytics.consent`; `setConsent(consent)` saves a complete choice and
`update(partial)` merges a partial one into the current consent.

[Events and identity](/guides/events/) lists the standard events and what each
provider receives.

## 5. Report errors

Errors that reach Angular's `ErrorHandler`, from templates, event listeners and
change detection, are sent through `captureError`, as described in step 2.
Errors that also reach the window's `error` event, which
`provideBrowserGlobalErrorListeners()` forwards to the `ErrorHandler`, are
reported once.

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.

The [Angular example](https://github.com/nicolopadovan/consentlayer/tree/main/apps/example-angular)
in the repository runs this setup, with server-side rendering.
