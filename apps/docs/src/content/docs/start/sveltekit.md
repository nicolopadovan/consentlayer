---
title: SvelteKit
description: Set up ConsentLayer in a SvelteKit application with consentlayer/sveltekit.
---

This guide sets up ConsentLayer in a SvelteKit application: a module-level
analytics instance, a root layout that holds consent state for your consent
banner, page views on every navigation, event tracking, and error reporting.
`consentlayer/sveltekit` exports everything [`consentlayer/svelte`](/start/svelte/)
does, with a `consentLayer()` that follows SvelteKit's navigation itself, and
`handleErrorWith()` for the client `handleError` hook.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Create the instance

Create the instance once, at module level, in a file your components import.
Pass each provider its ID from the environment. SvelteKit 3 declares
environment variables in `src/env.ts`; a variable with `public: true` can be
imported in browser code from `$app/env/public`:

```ts
// src/env.ts
import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
  GA4_MEASUREMENT_ID: { public: true, schema: (value) => value ?? '' },
  FACEBOOK_PIXEL_ID: { public: true, schema: (value) => value ?? '' },
})
```

```ts
// src/lib/analytics.ts
import { FACEBOOK_PIXEL_ID, GA4_MEASUREMENT_ID } from '$app/env/public'
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'

export const analytics = createAnalytics({
  providers: [ga4({ measurementId: GA4_MEASUREMENT_ID }), meta({ pixelId: FACEBOOK_PIXEL_ID })],
  autoTracking: true,
})
```

A `schema` function receives the raw value, `undefined` when the variable is
not set, and returns the value your code imports. Without a schema, SvelteKit
refuses to start when the variable is missing.

The options are the same as in React; [React](/start/react/#1-create-the-instance)
explains how missing IDs, `autoTracking`, `enabled` and `debug` behave.

## 2. Call `consentLayer` in the root layout

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { consentLayer } from 'consentlayer/sveltekit'
  import { analytics } from '#lib/analytics.ts'
  import ConsentBanner from '#lib/ConsentBanner.svelte'

  let { children } = $props()
  const consent = consentLayer({ analytics })
</script>

{@render children()}
<ConsentBanner privacyPolicyUrl="/privacy" />
{#if consent.ready && !consent.bannerVisible}
  <button type="button" onclick={consent.openDialog}>Cookie settings</button>
{/if}
```

`consentLayer()` sets a context, so call it while the component initializes,
in its `<script>`, not in a callback. Once the layout is mounted in the
browser, it performs these steps:

1. It calls `analytics.consent.bootstrap()`, which reads the stored choice from
   `localStorage`, or from your consent adapters if nothing is stored. When
   neither yields a choice, `bannerVisible` becomes `true`, unless
   `autoShowBanner` is `false`.
2. It schedules `analytics.boot()` according to the
   [`boot`](/start/react/#boot-timing) option.
3. It sends a page view to every active provider. A provider that becomes
   active later, because the visitor grants its category, receives the current
   page view at that point.
4. Through SvelteKit's `afterNavigate`, after every navigation to a new path or
   query string, it sends a page view and calls `analytics.newPageSession()`.
   A change to the hash alone sends nothing.

When the layout is destroyed, it stops. On the server it does nothing, and
`ready` stays `false`, so the banner is not rendered there and the HTML matches
the first render in the browser.

It takes the options of the [Svelte `consentLayer()`](/start/svelte/#2-call-consentlayer-in-the-root-component)
except `afterNavigate`, and returns the same object as
`useConsentController()`, with the state as reactive properties: read
`consent.bannerVisible` directly, since destructuring it reads the value once.

## 3. Add the banner

Copy the [Svelte consent banner recipe](/guides/consent-ui/#svelte) into
`src/lib/ConsentBanner.svelte` and render it once, in the root layout as above.
In other components, `useConsentController()` from `consentlayer/sveltekit`
returns the object `consentLayer()` returned; it throws when no parent
component called `consentLayer()`.

<details>
<summary>Meta Pixel without JavaScript</summary>

`<MetaPixelNoscript>` renders Meta's `<noscript>` PageView image,
`https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`, in the HTML
SvelteKit renders on the server:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { FACEBOOK_PIXEL_ID } from '$app/env/public'
  import { MetaPixelNoscript } from 'consentlayer/sveltekit'
</script>

<MetaPixelNoscript pixelId={FACEBOOK_PIXEL_ID} enabled />
```

Visitors with JavaScript disabled never see the consent banner, so the image
tracks them without consent. For that reason it renders nothing unless you pass
`enabled`, and nothing while `pixelId` is `undefined` or empty. Other
attributes are passed to the image.

</details>

## 4. Track events

`useAnalytics()` returns the instance passed to `consentLayer()`. Call it while
a component initializes. Outside components, import the instance from
`src/lib/analytics.ts`.

```svelte
<script lang="ts">
  import { useAnalytics } from 'consentlayer/sveltekit'

  const analytics = useAnalytics()
</script>

<button onclick={() => analytics.track('sign_up', { method: 'email' })}>Sign up</button>
```

`useConsent()` returns an object whose `consent` property holds the current
consent, `null` before a choice. [Svelte](/start/svelte/#4-track-events)
describes both, and [Events and identity](/guides/events/) lists the standard
events and what each provider receives.

## 5. Report errors

Every error during loading, rendering and navigation in the browser reaches
SvelteKit's client `handleError` hook. `handleErrorWith()` returns a hook that
sends the ones your code threw:

```ts
// src/hooks.client.ts
import { handleErrorWith } from 'consentlayer/sveltekit'
import { analytics } from '#lib/analytics.ts'

export const handleError = handleErrorWith(analytics)
```

It calls `captureError(error, { source: 'boundary' })` when `kind` is
`'unknown'`, for errors thrown by your code or code it calls. Errors from
`error()`, `'app'`, and those SvelteKit generates, such as 404s,
`'framework'`, are expected, so it skips them. It returns nothing, so SvelteKit
shows its default message. To return your own, call `captureError` in your own
hook instead.

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.

The [SvelteKit example](https://github.com/nicolopadovan/analytics-consent-manager-npm/tree/main/apps/example-sveltekit)
in the repository runs this setup.
