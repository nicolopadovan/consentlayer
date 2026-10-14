---
title: Vue
description: Set up ConsentLayer in a Vue 3 application with consentlayer/vue.
---

This guide sets up ConsentLayer in a Vue application with Vite and Vue Router:
a module-level analytics instance, a Vue plugin that holds consent state for
your consent banner, page views on every navigation, event tracking, and error
reporting. `consentlayer/vue` supports Vue 3.5.17 and later. For Nuxt, follow
[Nuxt](/start/nuxt/) instead.

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
explains how missing IDs, `autoTracking`, `enabled` and `debug` behave.

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

<details>
<summary>Meta Pixel and GTM without JavaScript</summary>

`<MetaPixelNoscript>` renders Meta's `<noscript>` PageView image,
`https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`, for visitors
with JavaScript disabled:

```vue
<script setup lang="ts">
import { MetaPixelNoscript } from 'consentlayer/vue'
</script>

<template>
  <MetaPixelNoscript :pixel-id="pixelId" enabled />
</template>
```

Those visitors never see the consent banner, so the image tracks them without
consent. For that reason it renders nothing unless you pass `enabled`, and
nothing while `pixel-id` is `undefined` or empty. Other attributes are passed
to the image. It only has an effect in HTML rendered on the server, as with
Nuxt or Vue's `renderToString`; an application rendered only in the browser
never shows it.

`<GtmNoscript :container-id="…" enabled />` from `consentlayer/vue` does the
same for Google Tag Manager's `<noscript>` iframe; see
[Google Tag Manager](/guides/providers/gtm/#without-javascript).

</details>

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
