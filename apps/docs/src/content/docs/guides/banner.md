---
title: Banner
description: Add ConsentLayer's ready-made consent banner, settings dialog and reopen badge with a framework component, from JavaScript or with the script tag, and place, word and style them.
---

`consentlayer/banner` renders a consent banner, a settings dialog and a badge
that reopens the settings. It is the same banner the
[script tag](/start/script-tag/#3-the-banner) loads from the CDN. It needs no
framework: it mounts on a consent controller from
[`createConsentController()`](/start/javascript/). The framework bindings have
[a component for it](#frameworks).

The banner's default text and layout have not been legally reviewed. Whether
they are enough where you and your visitors are is your responsibility; see
the [legal notice](/guides/legal/).

## Mount the banner

```ts
import { createAnalytics, createConsentController } from 'consentlayer'
import { mountBanner } from 'consentlayer/banner'

const analytics = createAnalytics({ providers: [] })
const controller = createConsentController(analytics)
controller.start()

const unmount = mountBanner(controller, {
  position: 'bottom-left',
  privacyPolicyUrl: '/privacy',
})
```

`mountBanner(controller, options)` adds the banner, the dialog and the badge to
`<body>` and a `<style>` element to `<head>`, and updates them from the
controller's state. It returns a function that removes them.

The banner shows while the controller's `bannerVisible` is `true`: when there
is no stored choice, the stored choice is [stale](/guides/consent-ui/#asking-again),
or only the [region's](/guides/regions/) defaults are in force, as in
Switzerland. It stays hidden where the region's rule sets `banner: false`, as
the US rule does by default, and when `autoShowBanner` is `false`. It offers
Accept all, Reject non-essential and Customize. Customize opens the settings
dialog, a modal `<dialog>` with a switch for each category, which keeps focus
inside while open, closes with Escape and returns focus to the button that
opened it, or to the [badge](#badge) when the visitor chose and that button is
gone. Switches the visitor changes and then closes without saving are
discarded.

## Frameworks

Each framework binding has a thin component that mounts this same banner on the
controller the binding already holds, so you do not call `mountBanner`
yourself. The options are the `BannerOptions` of [Options](#options), passed as
props, and the banner follows the same consent state as
[`useConsentController()`](/guides/consent-ui/): `autoShowBanner: false` and
`openDialog()` apply to it too. Every component is client-only: it renders
nothing in place, adds the banner, the dialog and the badge to `<body>` in the
browser and never on the server, and removes them when it unmounts.

Each component is its own entry point, `consentlayer/<framework>/banner`, so an
application that builds its own banner does not download this one. Each throws
an error that names the missing setup when the binding's provider or plugin is
absent; the message is in its section.

### React and Next.js

Render `<ConsentBanner>` from `consentlayer/react/banner` inside
`<AnalyticsProvider>`, from either `consentlayer/react` or `consentlayer/next`:

```tsx
import { AnalyticsProvider } from 'consentlayer/react'
import { ConsentBanner } from 'consentlayer/react/banner'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'

export function AnalyticsShell({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider analytics={analytics}>
      {children}
      <ConsentBanner position="bottom-center" privacyPolicyUrl="/privacy" />
    </AnalyticsProvider>
  )
}
```

The entry point starts with a `'use client'` directive, like
`consentlayer/react`. Outside `<AnalyticsProvider>`, it throws
`ConsentBanner must be used within AnalyticsProvider`. The banner mounts again
when the options change by value, so passing a new `text` object on every render
does not rebuild it.

### Vue and Nuxt

Import `ConsentBanner` from `consentlayer/vue/banner` and render it in any
component. Its props are the options, in kebab case in templates. Bind a
prop that is not a string with `v-bind`, such as `:badge="false"`:

```vue
<script setup lang="ts">
import { ConsentBanner } from 'consentlayer/vue/banner'
</script>

<template>
  <RouterView />
  <ConsentBanner position="bottom-center" privacy-policy-url="/privacy" :badge="false" />
</template>
```

It needs `app.use(consentLayer, { analytics })` from `consentlayer/vue`, and
throws `ConsentBanner needs app.use(consentLayer)` without it. In Nuxt, the
module installs the plugin, so import the component in `app/app.vue` the same
way. It needs no `<ClientOnly>`, since it renders the same empty node on the
server and in the browser. The banner mounts again when a prop changes by value,
so passing a new `text` object on every render does not rebuild it.

### Svelte and SvelteKit

Use the `consentBanner` action from `consentlayer/svelte/banner` on any element,
such as `<svelte:body>`, in the component that calls `consentLayer()` or one
below it:

```svelte
<script lang="ts">
  import { consentLayer } from 'consentlayer/sveltekit'
  import { consentBanner } from 'consentlayer/svelte/banner'
  import { analytics } from '#lib/analytics.ts'

  let { children } = $props()
  consentLayer({ analytics })
</script>

{@render children()}
<svelte:body use:consentBanner={{ position: 'bottom-center', privacyPolicyUrl: '/privacy' }} />
```

The banner mounts again when the action's options change. To mount it from a
component's `<script>` instead, call `useConsentBanner(options)`, which mounts
it when the component mounts and reads the options once. Both throw
`consentBanner needs consentLayer() in a parent component` when
`consentLayer()` has not been called in the component or a parent. Without
SvelteKit, import `consentLayer` from `consentlayer/svelte`. The entry point also
exports the `BannerOptions` type.

### Solid and SolidStart

Render `<ConsentBanner>` from `consentlayer/solid/banner` inside
`<AnalyticsProvider>`, from either `consentlayer/solid` or
`consentlayer/solidstart`:

```tsx
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { AnalyticsProvider } from 'consentlayer/solidstart'
import { ConsentBanner } from 'consentlayer/solid/banner'
import { Suspense } from 'solid-js'
import { analytics } from '~/lib/analytics'

export default function App() {
  return (
    <Router
      root={(props) => (
        <AnalyticsProvider analytics={analytics}>
          <Suspense>{props.children}</Suspense>
          <ConsentBanner position="bottom-center" privacyPolicyUrl="/privacy" />
        </AnalyticsProvider>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
```

The banner mounts again when a prop changes. Outside `<AnalyticsProvider>`, it
throws `ConsentBanner must be used within AnalyticsProvider`.

### Angular

Add `provideConsentBanner(options)` from `consentlayer/angular/banner` to the
application config, next to `provideConsentLayer()`. There is no component to
render:

```ts
import { provideConsentLayer } from 'consentlayer/angular'
import { provideConsentBanner } from 'consentlayer/angular/banner'

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    provideConsentLayer({ analytics }),
    provideConsentBanner({ position: 'bottom-center', privacyPolicyUrl: '/privacy' }),
  ],
}
```

It mounts the banner in the browser when the application starts, reads the
options once, and removes the banner when the application is destroyed. Without
`provideConsentLayer()`, it throws `injectConsentController needs provideConsentLayer()`.
When you do not set `nonce`, it uses the application's `CSP_NONCE`, if provided.

## Options

| Option             | Type                                               | Default         | Description                                                                                          |
| ------------------ | -------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| `position`         | See [Placement](#placement)                        | `'bottom-left'` | Where the banner sits.                                                                               |
| `overlay`          | `boolean`                                          | `false`         | Dims the page behind the banner. Visual only: the page stays usable.                                 |
| `blocking`         | `boolean`                                          | `false`         | Keeps the page from being used until the visitor chooses. See [Blocking](#blocking).                 |
| `emphasis`         | `'equal' \| 'accept'`                              | `'equal'`       | `equal` gives Accept all and Reject non-essential the same look; `accept` fills only Accept all.     |
| `closeButton`      | `boolean`                                          | `false`         | Adds an × in the corner that rejects non-essential categories, labeled with the `dismiss` text.      |
| `badge`            | `false \| { show?, position?, label?, attached? }` | `{}`            | The button that reopens the settings. See [Badge](#badge).                                           |
| `privacyPolicyUrl` | `string`                                           |                 | Links the privacy policy. See [Text](#text).                                                         |
| `cookiePolicyUrl`  | `string`                                           |                 | Links the cookie policy.                                                                             |
| `termsUrl`         | `string`                                           |                 | Links the terms of service.                                                                          |
| `text`             | `object`                                           |                 | Overrides any string. See [Text](#text).                                                             |
| `classNames`       | `Partial<Record<part, string>>`                    |                 | Classes added to each part. See [Styling](#styling).                                                 |
| `unstyled`         | `boolean`                                          | `false`         | Leaves out the built-in stylesheet.                                                                  |
| `nonce`            | `string`                                           |                 | Set on the built-in `<style>` element, for a Content Security Policy with a nonce-based `style-src`. |

## Placement

`position` takes one of nine values. `top` and `bottom` span the width of the
page as a bar; the others float as a card. On screens narrower than 30rem, a
card spans the width of the screen and the buttons stack, Accept all first.

| `position`                    | Layout                      |
| ----------------------------- | --------------------------- |
| `bottom-left`, `bottom-right` | A card in the corner        |
| `top-left`, `top-right`       | A card in the corner        |
| `bottom-center`, `top-center` | A wider card, centered      |
| `center`                      | A wider card, in the middle |
| `bottom`, `top`               | A bar across the page       |

The settings dialog is always centered. While it is open, the banner is
hidden, and it returns when the dialog closes without a choice.

### Blocking

With `blocking: true`, the banner is a modal `<dialog>`: the rest of the page
cannot be clicked, focused or scrolled, and Escape does not close it, until
the visitor chooses. Focus starts on the banner itself, so a screen reader
announces its title first, and the first Tab reaches Accept all. Combine it with
`overlay: true` to also dim the page, so visitors can see why it does not
respond.

Whether a site may be blocked until a choice is made depends on the law where
you and your visitors are. Check it before you turn this on; see the
[legal notice](/guides/legal/).

## Badge

After the visitor has chosen, a round button with a cookie icon stays on the
page and reopens the settings. It appears only once a choice is stored: a first
visit where the banner stays hidden, such as in the US or with
`autoShowBanner: false`, has no badge, and neither does a visit where the only
consent in force is the [region's](/guides/regions/) defaults or a consent
platform's provisional answer. `show: 'always'` shows it before a choice too.
When the visitor chooses, focus moves to the badge, since the button they
pressed is gone. `badge: false` removes it, and focus is then left alone; link
to `CONSENTLAYER_openConsent()` from your footer instead, as
[Reopening the settings](/guides/consent-ui/#reopening-the-settings) shows.

| Option     | Type                                                     | Default          | Description                                                                                                                                                        |
| ---------- | -------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `show`     | `'after-choice' \| 'always'`                             | `'after-choice'` | `after-choice` shows it once the visitor has chosen and the banner is closed. `always` shows it from the start, also while the banner is open, beneath the banner. |
| `position` | A corner, `top-center`, `bottom-center`, `left`, `right` | `'bottom-left'`  | Where the badge sits.                                                                                                                                              |
| `label`    | `boolean`                                                | `false`          | Shows the `badge` text next to the icon. Without it, the text is the button's name.                                                                                |
| `attached` | `boolean`                                                | `false`          | Sits flush against the nearest edge, the side edge for a corner.                                                                                                   |

With the [IAB TCF adapter](/guides/adapters/tcf/), the choice is the CMP's. The
consent the CMP reports before the visitor has chosen is provisional and does
not show the badge, but once the CMP reports a choice, ConsentLayer stores it
and the badge appears. The badge opens ConsentLayer's dialog, whose choices are
not written back to the CMP, so set `badge: false` (`data-badge="false"` on the
script tag) and link to the CMP's own settings instead.

## Text

The text is in English. Override any string with `text`:

```ts
mountBanner(controller, {
  privacyPolicyUrl: '/privacy',
  text: {
    title: 'Your privacy',
    message: 'We use cookies for analytics. Read our {privacyPolicy}.',
  },
})
```

Each string may contain:

- `[label](url)`, a link. Only `http:`, `https:`, `mailto:` and relative URLs
  become links; any other is shown as its label. The same holds for
  `privacyPolicyUrl`, `cookiePolicyUrl` and `termsUrl`: any other counts as not
  set.
- `**bold**`.
- `{privacyPolicy}`, `{cookiePolicy}` and `{terms}`, replaced with a link to
  the matching URL option, labeled with the `privacyPolicy`, `cookiePolicy` or
  `terms` text. Without the URL, the label is shown as plain text.

A policy whose URL is set but whose placeholder is not in `message` is linked
after the message. Strings are inserted as text, never as HTML.

| `text` key               | Default                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `title`                  | Cookies                                                                                           |
| `message`                | We use cookies to run this site and, with your consent, for preferences, analytics and marketing. |
| `privacyPolicy`          | Privacy policy                                                                                    |
| `cookiePolicy`           | Cookie policy                                                                                     |
| `terms`                  | Terms of service                                                                                  |
| `gpc`                    | Your browser's Global Privacy Control signal is on, so marketing is off unless you switch it on.  |
| `acceptAll`              | Accept all                                                                                        |
| `rejectNonEssential`     | Reject non-essential                                                                              |
| `customize`              | Customize                                                                                         |
| `dismiss`                | Continue without accepting                                                                        |
| `settingsTitle`          | Cookie settings                                                                                   |
| `settingsMessage`        | Empty: no text above the switches                                                                 |
| `necessaryLabel`         | Necessary                                                                                         |
| `necessaryDescription`   | Needed for the site to work, such as remembering this choice. Always on.                          |
| `preferencesLabel`       | Preferences                                                                                       |
| `preferencesDescription` | Remember settings such as language or region.                                                     |
| `analyticsLabel`         | Analytics                                                                                         |
| `analyticsDescription`   | Help us understand how the site is used.                                                          |
| `marketingLabel`         | Marketing                                                                                         |
| `marketingDescription`   | Measure our ads and show relevant ones on other sites.                                            |
| `close`                  | Close                                                                                             |
| `save`                   | Save choices                                                                                      |
| `badge`                  | Cookie settings                                                                                   |

The `gpc` line shows under the message only while the visitor's browser sends
the [Global Privacy Control](/guides/consent-ui/#global-privacy-control)
signal. A [custom category](/guides/consent-ui/#custom-categories) gets a
switch labeled with the `<category>Label` and `<category>Description` texts.

## Styling

By default the banner takes its font and text color from the page and its
background from the page's [`color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme):
it is light on a light page and dark on a page that declares
`color-scheme: dark`, or `light dark` for a visitor whose system is dark. A
page that is dark only through its own colors, without `color-scheme`, gets a
light banner; set the custom properties below.

### Custom properties

Set them on `:root` or any ancestor of `<body>`:

```css
:root {
  --consentlayer-accent: #4f46e5;
  --consentlayer-radius: 1.25rem;
}
```

| Property                       | Default                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `--consentlayer-background`    | `Canvas`                                                         |
| `--consentlayer-color`         | `CanvasText`                                                     |
| `--consentlayer-border`        | `rgb(128 128 128 / .3)`                                          |
| `--consentlayer-radius`        | `.75rem`                                                         |
| `--consentlayer-button-radius` | `.5rem`                                                          |
| `--consentlayer-accent`        | `CanvasText`, for the filled buttons, the switches and the badge |
| `--consentlayer-accent-color`  | `Canvas`, the text on filled buttons                             |
| `--consentlayer-font`          | `inherit`                                                        |
| `--consentlayer-backdrop`      | `rgb(0 0 0 / .3)`, behind the dialog and with `overlay`          |
| `--consentlayer-z-index`       | `1000`; the badge sits one below                                 |

### Classes and Tailwind

`classNames` adds classes to each part: `banner`, `title`, `message`,
`actions`, `acceptAll`, `rejectNonEssential`, `customize`, `dismiss`,
`dialog`, `settingsTitle`, `settingsMessage`, `category`, `close`, `save` and
`badge`.

```ts
mountBanner(controller, {
  classNames: {
    banner: 'bg-zinc-900 text-zinc-50 rounded-2xl',
    acceptAll: 'bg-emerald-500 text-zinc-950',
    rejectNonEssential: 'bg-emerald-500 text-zinc-950',
  },
})
```

The built-in stylesheet is in the cascade layer `components.consentlayer` and
uses only `:where()` selectors, so your classes and any rule outside a layer
win over it. Tailwind CSS v4 puts its utilities in a later layer, so they win
too. Every part also has a stable class, such as `.consentlayer-banner`,
`.consentlayer-dialog` and `.consentlayer-badge`, for your own CSS.
`unstyled: true` leaves the stylesheet out entirely.

<details>
<summary>Resets outside a layer</summary>

Because rules outside a layer win over the built-in stylesheet, a reset such
as Tailwind CSS v3's preflight or Bootstrap's reboot also overrides parts of
it, for example button backgrounds. Put the reset in a layer, or restyle the
affected parts with `classNames`.

</details>

<details>
<summary>Browser support</summary>

The banner works in every browser ConsentLayer supports. A few parts of its
look need newer browsers and are left out by older ones:

- Cascade layers need Chrome 99, Firefox 97 and Safari 15.4. Older browsers
  ignore the built-in stylesheet, so the banner works but is unstyled.
- Stopping the page from scrolling while the dialog or a blocking banner is
  open needs `:has()`: Chrome 105, Firefox 121 and Safari 15.4.
- The exit animations need `transition-behavior: allow-discrete`: Chrome 117,
  Firefox 129 and Safari 17.4. Older browsers hide the banner without one.

With `prefers-reduced-motion: reduce`, the banner does not animate. In forced
colors mode, such as Windows High Contrast, it uses the system colors. It is
not printed.

</details>

## Script tag

The [script tag](/start/script-tag/#3-the-banner) build takes the same options
from `window.ConsentLayer.banner`, or from `data-` attributes on its own
`<script>` tag: `data-position`, `data-overlay`, `data-blocking`,
`data-close-button`, `data-emphasis`, `data-badge` (`false`, `after-choice` or
`always`), `data-badge-position`, `data-badge-label`, `data-badge-attached`,
`data-privacy-policy-url`, `data-cookie-policy-url`, `data-terms-url`, and
`data-text-*` for each text key in kebab case, such as `data-text-accept-all`.
An attribute wins over `window.ConsentLayer.banner`.
