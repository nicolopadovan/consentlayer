---
title: Svelte
description: Set up ConsentLayer in a Svelte 5 application with consentlayer/svelte.
---

This guide sets up ConsentLayer in a Svelte application built with Vite: a
module-level analytics instance, a root component that holds consent state for
your consent banner, page views, event tracking, and error reporting.
`consentlayer/svelte` supports Svelte 5.7 and later, with runes. For
SvelteKit, follow [SvelteKit](/start/sveltekit/) instead.

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

## 2. Call `consentLayer` in the root component

Call `consentLayer()` in your root component:

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

`consentLayer()` sets a context, so call it while the component initializes,
in its `<script>`, not in a callback. Once the component is mounted, it
performs these steps:

1. It calls `analytics.consent.bootstrap()`, which reads the stored choice from
   `localStorage`, or from your consent adapters if nothing is stored. When
   neither yields a choice, `bannerVisible` becomes `true`, unless
   `autoShowBanner` is `false`.
2. It schedules `analytics.boot()` according to the
   [`boot`](/start/react/#boot-timing) option.
3. It sends a page view to every active provider. A provider that becomes
   active later, because the visitor grants its category, receives the current
   page view at that point.

When the component is destroyed, it stops. On the server it does nothing, and
`ready` stays `false`, so the banner is not rendered there and the HTML matches
the first render in the browser.

`consentLayer()` returns the same object as `useConsentController()`. Its
state is reactive properties, so read `consent.bannerVisible` directly;
destructuring it reads the value once.

| Option | Type | Default | Description |
|---|---|---|---|
| `analytics` | `Analytics` | Required | The instance from `createAnalytics()`. |
| `afterNavigate` | `(callback) => void` | | Sends a page view per navigation. See [Client-side routing](#client-side-routing). |
| `page` | `{ url?, path?, title? }` | `location` and `document.title` | Overrides the page view's details. |
| `boot` | `{ mode?, timeoutMs? }` | `{ mode: 'immediate' }` | When providers start. |
| `autoShowBanner` | `boolean` | `true` | Whether `bannerVisible` becomes `true` when there is no stored choice. |
| `openConsentGlobalKey` | `string` | `'CONSENTLAYER_openConsent'` | The `window` function that opens the settings dialog from outside Svelte. |

### Client-side routing

Without `afterNavigate`, `consentLayer()` sends one page view for the page
load. With a client-side router, pass a function that registers a callback and
calls it after every navigation with `{ to: { url } }`, where `url` is the new
`URL`. ConsentLayer sends a page view and calls `analytics.newPageSession()`
when the path or query string changes; a change to the hash alone sends
nothing. It must call the callback once for the first page too.

## 3. Add the banner

Copy the [Svelte consent banner recipe](/guides/consent-ui/#svelte) into
`src/lib/ConsentBanner.svelte`, change its import to `consentlayer/svelte`, and
render it once, in the root component as above. In other components,
`useConsentController()` returns the object `consentLayer()` returned; it
throws when no parent component called `consentLayer()`.

<details>
<summary>Meta Pixel without JavaScript</summary>

`<MetaPixelNoscript>` renders Meta's `<noscript>` PageView image,
`https://www.facebook.com/tr?id=<pixelId>&ev=PageView&noscript=1`, for visitors
with JavaScript disabled:

```svelte
<script lang="ts">
  import { MetaPixelNoscript } from 'consentlayer/svelte'
</script>

<MetaPixelNoscript pixelId={pixelId} enabled />
```

Those visitors never see the consent banner, so the image tracks them without
consent. For that reason it renders nothing unless you pass `enabled`, and
nothing while `pixelId` is `undefined` or empty. Other attributes are passed to
the image. It only has an effect in HTML rendered on the server, as with
SvelteKit or `render` from `svelte/server`; an application rendered only in the
browser never shows it. The component ships as Svelte source, which your Svelte
compiler builds with your application.

</details>

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

`consentLayer()` does not catch errors itself. Wrap your components in
`<svelte:boundary>` and report from its `onerror`:

```svelte
<svelte:boundary onerror={(error) => analytics.captureError(error, { source: 'boundary' })}>
  <Page />
</svelte:boundary>
```

As in React, `captureError` reaches the providers that implement error
reporting, Sentry and PostHog, and the window's `error` and
`unhandledrejection` events are reported after boot unless you set
`errors: { globalHandlers: false }`.
