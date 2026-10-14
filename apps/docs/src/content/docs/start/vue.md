---
title: Vue and Nuxt
description: Set up ConsentLayer in a Vue 3 or Nuxt application with consentlayer/vue.
---

This guide sets up ConsentLayer in a Vue application, with Vite and Vue Router
or with Nuxt: a module-level analytics instance, a Vue plugin that holds
consent state for your consent banner, page views on every navigation, event
tracking, and error reporting. `consentlayer/vue` supports Vue 3.5 and later;
with Nuxt, it needs Nuxt 4.

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

The options are the same as in React; [React](/start/react/#1-create-the-instance)
explains how missing IDs, `autoTracking`, `enabled` and `debug` behave. With
Nuxt, create the instance in a plugin instead, as shown in [Nuxt](#nuxt).

## 2. Install the plugin

Install `consentLayer` after your router, and pass it the router so it sends a
page view on every navigation:

```ts
// src/main.ts
import { consentLayer } from 'consentlayer/vue'
import { createApp } from 'vue'
import App from './App.vue'
import { analytics } from './analytics'
import { router } from './router'

createApp(App)
  .use(router)
  .use(consentLayer, { analytics, router })
  .mount('#app')
```

In the browser, `app.use(consentLayer, options)` performs these steps:

1. It calls `analytics.consent.bootstrap()`, which reads the stored choice from
   `localStorage`, or from your consent adapters if nothing is stored. When
   neither yields a choice, `useConsentController()` reports
   `bannerVisible: true`, unless `autoShowBanner` is `false`.
2. It schedules `analytics.boot()` according to the
   [`boot`](/start/react/#boot-timing) option.
3. Once the router is ready, it sends a page view to every active provider. A
   provider that becomes active later, because the visitor grants its
   category, receives the current page view at that point.
4. After every successful navigation to a new path or query string, it sends a
   page view and calls `analytics.newPageSession()`. A change to the hash
   alone sends nothing.

Without `router`, it sends one page view for the page load. On the server, it
only provides the instance and the initial state.

| Option | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | Required | The instance from `createAnalytics()`. |
| `router` | Vue Router instance | | Sends a page view per navigation. |
| `page` | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details. |
| `boot` | `{ mode?, timeoutMs? }` | `{ mode: 'immediate' }` | When providers start. |
| `autoShowBanner` | `boolean` | `true` | Whether `bannerVisible` becomes `true` when there is no stored choice. |
| `openConsentGlobalKey` | `string` | `'CONSENTLAYER_openConsent'` | The `window` function that opens the settings dialog from outside Vue. |
| `captureErrors` | `boolean` | `true` | Reports errors from `app.config.errorHandler`. See [Report errors](#5-report-errors). |

## 3. Add the banner

Copy the [Vue consent banner recipe](/guides/consent-ui/#vue) into
`src/components/ConsentBanner.vue`, render it once, and give visitors a way to
reopen their settings:

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { useConsentController } from 'consentlayer/vue'
import ConsentBanner from './components/ConsentBanner.vue'

const { bannerVisible, openDialog } = useConsentController()
</script>

<template>
  <RouterView />
  <ConsentBanner privacy-policy-url="/privacy" />
  <button v-if="!bannerVisible" type="button" @click="openDialog">Cookie settings</button>
</template>
```

`useConsentController()` returns the state as read-only refs and the actions
as functions. It throws when `consentLayer` is not installed.

## 4. Track events

`useAnalytics()` returns the instance passed to `consentLayer`, or the most
recently created instance when the plugin is not installed. Outside
components, import the instance from `src/analytics.ts`.

```vue
<script setup lang="ts">
import { useAnalytics } from 'consentlayer/vue'

const analytics = useAnalytics()
</script>

<template>
  <button @click="analytics.track('sign_up', { method: 'email' })">Sign up</button>
</template>
```

`useConsent()` returns `consent`, a ref holding the current consent, `null`
before a choice. Called in a component's `setup`, it stops listening when the
component unmounts. [Events and identity](/guides/events/) lists the standard
events and what each provider receives.

## 5. Report errors

The plugin wraps `app.config.errorHandler`, so errors thrown in components,
watchers and lifecycle hooks are sent through
`captureError(error, { source: 'boundary', tags: { vue_info } })`, where
`vue_info` is Vue's description of where the error happened. It then calls the
handler that was set before `app.use(consentLayer)`, or `console.error` when
there was none. A handler assigned after `app.use(consentLayer)` replaces the
wrapper, so set yours first. Pass `captureErrors: false` to leave the handler
alone.

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.

## Nuxt

Create the instance and install the plugin in a Nuxt plugin. Nuxt runs it on
the server for each request and once in the browser, so `useAnalytics()` and
`useConsentController()` work in every component:

```ts
// app/plugins/consentlayer.ts
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { consentLayer } from 'consentlayer/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public
  const analytics = createAnalytics({
    providers: [ga4({ measurementId: config.ga4MeasurementId })],
    autoTracking: true,
    debug: config.analyticsDebug,
  })
  nuxtApp.vueApp.use(consentLayer, { analytics, router: nuxtApp.$router })
})
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      ga4MeasurementId: '',
      analyticsDebug: false,
    },
  },
})
```

Nuxt fills `runtimeConfig.public` from environment variables at runtime:
`NUXT_PUBLIC_GA4_MEASUREMENT_ID` sets `ga4MeasurementId`. Nuxt parses a value
such as `true` into a boolean, so compare with `true`, not `'true'`.

The consent choice is only known in the browser. Render the banner, the
settings button and anything that reads `useConsent()` inside `<ClientOnly>`,
so the HTML rendered on the server matches the first render in the browser:

```vue
<!-- app/app.vue -->
<template>
  <NuxtPage />
  <ClientOnly>
    <ConsentBanner privacy-policy-url="/privacy" />
    <CookieSettingsButton />
  </ClientOnly>
</template>
```

<details>
<summary>Meta Pixel without JavaScript</summary>

`<MetaPixelNoscript>` is only exported from `consentlayer/react`. In Vue, add
Meta's image to the HTML rendered on the server yourself, replacing
`PIXEL_ID`:

```html
<noscript>
  <img height="1" width="1" style="display:none" alt=""
    src="https://www.facebook.com/tr?id=PIXEL_ID&ev=PageView&noscript=1" />
</noscript>
```

Visitors with JavaScript disabled never see the consent banner, so the image
tracks them without consent. Add it only where that is lawful.

</details>

The [Nuxt example](https://github.com/nicolopadovan/analytics-consent-manager-npm/tree/main/apps/example-nuxt)
in the repository runs this setup.
