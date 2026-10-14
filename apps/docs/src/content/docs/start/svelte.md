---
title: Svelte and SvelteKit
description: Set up ConsentLayer in a Svelte 5 or SvelteKit application with consentlayer/svelte.
---

This guide sets up ConsentLayer in a Svelte application, with SvelteKit or
with Svelte and Vite alone: a module-level analytics instance, a root component
that holds consent state for your consent banner, page views on every
navigation, event tracking, and error reporting. `consentlayer/svelte`
supports Svelte 5.7 and later, with runes.

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
refuses to start when the variable is missing. Without SvelteKit, read
`import.meta.env.VITE_GA4_MEASUREMENT_ID` instead.

The options are the same as in React; [React](/start/react/#1-create-the-instance)
explains how missing IDs, `autoTracking`, `enabled` and `debug` behave.

## 2. Call `consentLayer` in the root layout

Call `consentLayer()` in your root layout, and pass it SvelteKit's
`afterNavigate` so it sends a page view on every navigation:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { consentLayer } from 'consentlayer/svelte'
  import { analytics } from '#lib/analytics.ts'
  import ConsentBanner from '#lib/ConsentBanner.svelte'

  let { children } = $props()
  const consent = consentLayer({ analytics, afterNavigate })
</script>

{@render children()}
<ConsentBanner privacyPolicyUrl="/privacy" />
{#if consent.ready && !consent.bannerVisible}
  <button type="button" onclick={consent.openDialog}>Cookie settings</button>
{/if}
```

`consentLayer()` sets a context, so call it while the component initializes,
in its `<script>`, not in a callback. Once the component is mounted in the
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
4. After every navigation to a new path or query string, it sends a page view
   and calls `analytics.newPageSession()`. A change to the hash alone sends
   nothing.

Without `afterNavigate`, it sends one page view for the page load. When the
component is destroyed, it stops. On the server it does nothing, and `ready`
stays `false`, so the banner is not rendered there and the HTML matches the
first render in the browser.

`consentLayer()` returns the same object as `useConsentController()`. Its
state is reactive properties, so read `consent.bannerVisible` directly;
destructuring it reads the value once.

| Option | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | Required | The instance from `createAnalytics()`. |
| `afterNavigate` | `afterNavigate` from `$app/navigation` | | Sends a page view per navigation. |
| `page` | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details. |
| `boot` | `{ mode?, timeoutMs? }` | `{ mode: 'immediate' }` | When providers start. |
| `autoShowBanner` | `boolean` | `true` | Whether `bannerVisible` becomes `true` when there is no stored choice. |
| `openConsentGlobalKey` | `string` | `'CONSENTLAYER_openConsent'` | The `window` function that opens the settings dialog from outside Svelte. |

Without SvelteKit, call `consentLayer({ analytics })` in `App.svelte`.

## 3. Add the banner

Copy the [Svelte consent banner recipe](/guides/consent-ui/#svelte) into
`src/lib/ConsentBanner.svelte` and render it once, in the root layout as above.
In other components, `useConsentController()` returns the object
`consentLayer()` returned; it throws when no parent component called
`consentLayer()`.

## 4. Track events

`useAnalytics()` returns the instance passed to `consentLayer()`, or the most
recently created instance when it was not called. Call it while a component
initializes. Outside components, import the instance from
`src/lib/analytics.ts`.

```svelte
<script lang="ts">
  import { useAnalytics } from 'consentlayer/svelte'

  const analytics = useAnalytics()
</script>

<button onclick={() => analytics.track('sign_up', { method: 'email' })}>Sign up</button>
```

`useConsent()` returns an object whose `consent` property holds the current
consent, `null` before a choice, and updates when it changes. Read it in the
template or in `$derived` or `$effect`; Svelte listens for changes only while
something reads it. [Events and identity](/guides/events/) lists the standard
events and what each provider receives.

## 5. Report errors

`consentLayer()` does not catch errors itself. In SvelteKit, every error
during loading, rendering and navigation in the browser reaches the
`handleError` hook. Send the ones your code threw:

```ts
// src/hooks.client.ts
import type { HandleClientError } from '@sveltejs/kit/hooks'
import { analytics } from '#lib/analytics.ts'

export const handleError: HandleClientError = ({ kind, error }) => {
  if (kind === 'unknown') void analytics.captureError(error, { source: 'boundary' })
}
```

`kind` is `'unknown'` for errors thrown by your code or code it calls. Errors
from `error()`, `'app'`, and those SvelteKit generates, such as 404s,
`'framework'`, are expected, so this hook skips them. Without SvelteKit, wrap
your components in `<svelte:boundary>` and report from its `onerror`:

```svelte
<svelte:boundary onerror={(error) => analytics.captureError(error, { source: 'boundary' })}>
  <Page />
</svelte:boundary>
```

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.

<details>
<summary>Meta Pixel without JavaScript</summary>

`<MetaPixelNoscript>` is only exported from `consentlayer/react`. In
SvelteKit, add Meta's image to `src/app.html` yourself, replacing `PIXEL_ID`:

```html
<noscript>
  <img height="1" width="1" style="display:none" alt=""
    src="https://www.facebook.com/tr?id=PIXEL_ID&ev=PageView&noscript=1" />
</noscript>
```

Visitors with JavaScript disabled never see the consent banner, so the image
tracks them without consent. Add it only where that is lawful.

</details>

The [SvelteKit example](https://github.com/nicolopadovan/analytics-consent-manager-npm/tree/main/apps/example-sveltekit)
in the repository runs this setup.
