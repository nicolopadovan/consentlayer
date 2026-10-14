---
title: Nuxt
description: Set up ConsentLayer in a Nuxt 4 application with the consentlayer/nuxt module.
---

This guide sets up ConsentLayer in a Nuxt application: a Nuxt module that
creates the analytics instance from a config file, holds consent state for your
consent banner, sends page views on every navigation and reports errors. The
module is `consentlayer/nuxt` and needs Nuxt 4. It builds on
[`consentlayer/vue`](/start/vue/), whose functions it auto-imports.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Add the module

Add the module to `nuxt.config.ts`, and declare the provider IDs in
`runtimeConfig.public`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['consentlayer/nuxt'],
  runtimeConfig: {
    public: {
      ga4MeasurementId: '',
      facebookPixelId: '',
    },
  },
})
```

Nuxt fills `runtimeConfig.public` from environment variables at runtime:
`NUXT_PUBLIC_GA4_MEASUREMENT_ID` sets `ga4MeasurementId`.

## 2. Create the config file

The module reads the `createAnalytics()` options from
`app/consentlayer.config.ts`, and fails the build when the file is missing:

```ts
// app/consentlayer.config.ts
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'
import { autoTracking } from 'consentlayer/auto-tracking'

export default defineConsentLayerConfig(() => {
  const config = useRuntimeConfig().public
  return {
    providers: [
      ga4({ measurementId: config.ga4MeasurementId }),
      meta({ pixelId: String(config.facebookPixelId) }),
    ],
    autoTracking: autoTracking(),
  }
})
```

`defineConsentLayerConfig()` is auto-imported. Its function runs inside a Nuxt
plugin, on the server for each request and once in the browser, so composables
such as `useRuntimeConfig()` work in it. The options are the same as in React;
[React](/start/react/#1-create-the-instance) explains how missing IDs,
`autoTracking`, `enabled` and `debug` behave.

Nuxt parses environment values that look like JSON, so a pixel ID such as
`123456789012345` arrives as a number, and `true` as a boolean. `String()`
turns the ID back into the string the provider expects.

The module then installs the [`consentLayer`](/start/vue/#2-install-the-plugin)
Vue plugin with that instance and Nuxt's router. In the browser, it reads the
stored choice, schedules boot, and sends a page view for the first page and
after every navigation to a new path or query string.

Plugin options that are not functions go under the `consentlayer` key of
`nuxt.config.ts`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['consentlayer/nuxt'],
  consentlayer: { autoShowBanner: false },
})
```

| Option                 | Type                      | Default                         | Description                                                                                                                              |
| ---------------------- | ------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `page`                 | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details.                                                                                                       |
| `boot`                 | `{ mode?, timeoutMs? }`   | `{ mode: 'immediate' }`         | When providers start. See [Boot timing](/start/react/#boot-timing).                                                                      |
| `autoShowBanner`       | `boolean`                 | `true`                          | Whether `bannerVisible` becomes `true` when there is no stored choice or the stored choice is [stale](/guides/consent-ui/#asking-again). |
| `openConsentGlobalKey` | `string`                  | `'CONSENTLAYER_openConsent'`    | The `window` function that opens the settings dialog from outside Vue.                                                                   |
| `captureErrors`        | `boolean`                 | `true`                          | Reports component errors. See [Report errors](#5-report-errors).                                                                         |

## 3. Add the banner

Copy the [Vue consent banner recipe](/guides/consent-ui/#vue) into
`app/components/ConsentBanner.vue`. The consent choice is only known in the
browser, so render the banner, the settings button and anything that reads
`useConsent()` inside `<ClientOnly>`; the HTML rendered on the server then
matches the first render in the browser:

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

```vue
<!-- app/components/CookieSettingsButton.vue -->
<script setup lang="ts">
const { bannerVisible, openDialog } = useConsentController()
</script>

<template>
  <button v-if="!bannerVisible" type="button" @click="openDialog">Cookie settings</button>
</template>
```

`useConsentController()` is auto-imported, and returns the state as read-only
refs and the actions as functions.

<details>
<summary>Meta Pixel and GTM without JavaScript</summary>

The module registers `<MetaPixelNoscript>`, which renders Meta's `<noscript>`
PageView image, `https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`,
in the HTML rendered on the server:

```vue
<!-- app/app.vue -->
<script setup lang="ts">
const config = useRuntimeConfig().public
</script>

<template>
  <NuxtPage />
  <MetaPixelNoscript :pixel-id="String(config.facebookPixelId)" enabled />
</template>
```

Visitors with JavaScript disabled never see the consent banner, so the image
tracks them without consent. For that reason it renders nothing unless you pass
`enabled`, and nothing while `pixel-id` is `undefined` or empty. Other
attributes are passed to the image. Render it outside `<ClientOnly>`.

The module also registers `<GtmNoscript :container-id="…" enabled />`, which does the
same for Google Tag Manager's `<noscript>` iframe; see
[Google Tag Manager](/guides/providers/gtm/#without-javascript).

</details>

## 4. Track events

`useAnalytics()` and `useConsent()` are auto-imported:

```vue
<script setup lang="ts">
const analytics = useAnalytics()
</script>

<template>
  <button @click="analytics.track('sign_up', { method: 'email' })">Sign up</button>
</template>
```

`useConsent()` returns `{ consent, engine, setConsent, update }`. `consent` is a
read-only ref holding the current consent, `null` before a choice. `engine` is
`analytics.consent`; `setConsent(consent)` saves a complete choice and
`update(partial)` merges a partial one into the current consent.
[Vue](/start/vue/#4-track-events) describes both, and
[Events and identity](/guides/events/) lists the standard events and what each
provider receives.

## 5. Report errors

In the browser, the module listens to Nuxt's `vue:error` hook, so errors thrown
in components, watchers and lifecycle hooks are sent through
`captureError(error, { source: 'boundary', tags: { vue_info } })`. It leaves
`app.config.errorHandler` and Nuxt's error page alone. Set
`consentlayer: { captureErrors: false }` to turn this off.

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.

The [Nuxt example](https://github.com/nicolopadovan/consentlayer/tree/main/apps/example-nuxt)
in the repository runs this setup.
