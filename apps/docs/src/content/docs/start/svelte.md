---
title: Svelte & SvelteKit
description: Set up ConsentLayer in a SvelteKit or Svelte 5 application with consentlayer/sveltekit or consentlayer/svelte.
---

This guide sets up ConsentLayer in a SvelteKit application: a module-level
analytics instance, a root layout that holds consent state for your consent
banner, page views on every navigation, event tracking, and error reporting.
ConsentLayer supports Svelte 5.7 and later, with runes, with two entry points:

- `consentlayer/sveltekit` follows SvelteKit's navigation itself and adds
  `handleErrorWith()` for the client `handleError` hook.
- `consentlayer/svelte` exports the same functions and components, for a
  Svelte application without SvelteKit. Its differences are in
  [Without SvelteKit](#without-sveltekit).

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

`consentLayer()` returns the same object as `useConsentController()`. Its
state is reactive properties, so read `consent.bannerVisible` directly;
destructuring it reads the value once.

| Option | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | Required | The instance from `createAnalytics()`. |
| `page` | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details. |
| `boot` | `{ mode?, timeoutMs? }` | `{ mode: 'immediate' }` | When providers start. |
| `autoShowBanner` | `boolean` | `true` | Whether `bannerVisible` becomes `true` when there is no stored choice. |
| `openConsentGlobalKey` | `string` | `'CONSENTLAYER_openConsent'` | The `window` function that opens the settings dialog from outside Svelte. |

## 3. Add the banner

Copy the [Svelte consent banner recipe](/guides/consent-ui/#svelte) into
`src/lib/ConsentBanner.svelte` and render it once, in the root layout as above.
In other components, `useConsentController()` returns the object
`consentLayer()` returned; it throws when no parent component called
`consentLayer()`.

<details>
<summary>Meta Pixel and GTM without JavaScript</summary>

`<MetaPixelNoscript>` renders Meta's `<noscript>` PageView image,
`https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`, for visitors
with JavaScript disabled:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { FACEBOOK_PIXEL_ID } from '$app/env/public'
  import { MetaPixelNoscript } from 'consentlayer/sveltekit'
</script>

<MetaPixelNoscript pixelId={FACEBOOK_PIXEL_ID} enabled />
```

Those visitors never see the consent banner, so the image tracks them without
consent. For that reason it renders nothing unless you pass `enabled`, and
nothing while `pixelId` is `undefined` or empty. Other attributes are passed to
the image. It only has an effect in HTML rendered on the server, as with
SvelteKit or `render` from `svelte/server`; an application rendered only in the
browser never shows it. The component ships as Svelte source, which your Svelte
compiler builds with your application.

`<GtmNoscript containerId={…} enabled />` does the
same for Google Tag Manager's `<noscript>` iframe; see
[Google Tag Manager](/guides/providers/gtm/#without-javascript).

</details>

## 4. Track events

`useAnalytics()` returns the instance passed to `consentLayer()`, or the most
recently created instance when it was not called. Call it while a component
initializes. Outside components, import the instance from
`src/lib/analytics.ts`.

```svelte
<script lang="ts">
  import { useAnalytics } from 'consentlayer/sveltekit'

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

## Without SvelteKit

In a Svelte application without SvelteKit, import everything from
`consentlayer/svelte` instead, and call `consentLayer()` in your root
component. With Vite, the provider IDs come from `import.meta.env`, such as
`import.meta.env.VITE_GA4_MEASUREMENT_ID`.

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import { consentLayer } from 'consentlayer/svelte'
  import { analytics } from './lib/analytics'
  import ConsentBanner from './lib/ConsentBanner.svelte'
  import Page from './Page.svelte'

  const consent = consentLayer({ analytics })
</script>

<Page />
<ConsentBanner privacyPolicyUrl="/privacy" />
{#if consent.ready && !consent.bannerVisible}
  <button type="button" onclick={consent.openDialog}>Cookie settings</button>
{/if}
```

It sends one page view for the page load. With a client-side router, pass an
`afterNavigate` option: a function that registers a callback and calls it after
every navigation with `{ to: { url } }`, where `url` is the new `URL`.
ConsentLayer sends a page view and calls `analytics.newPageSession()` when the
path or query string changes; a change to the hash alone sends nothing. It must
call the callback once for the first page too.

`handleErrorWith()` is not available. Wrap your components in
`<svelte:boundary>` and report from its `onerror`:

```svelte
<svelte:boundary onerror={(error) => analytics.captureError(error, { source: 'boundary' })}>
  <Page />
</svelte:boundary>
```

The [SvelteKit example](https://github.com/nicolopadovan/analytics-consent-manager-npm/tree/main/apps/example-sveltekit)
in the repository runs the setup on this page.
