---
title: JavaScript and Astro
description: Set up ConsentLayer without a framework binding, with createConsentController, in plain JavaScript or an Astro site.
---

This guide sets up ConsentLayer in code that uses no framework binding: a
site built with a bundler such as Vite, or an Astro site. You create the
instance, then a consent controller, which does what the React provider and the
Vue plugin do for you: it reads the stored choice, boots the providers, holds
your banner's state and sends page views.

It assumes you have [installed](/start/installation/) `consentlayer` and the
SDKs of the providers you use.

## 1. Create the instance and the controller

```ts
// src/analytics.ts
import { createAnalytics, createConsentController } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'

export const analytics = createAnalytics({
  providers: [ga4({ measurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID })],
  autoTracking: true,
})

export const controller = createConsentController(analytics)
controller.start()
controller.setRoute(location.pathname + location.search)
```

`start()` performs the steps listed in [React](/start/react/#2-add-the-provider-and-the-banner):
it calls `analytics.consent.bootstrap()`, schedules `analytics.boot()`, and
sends a page view to each provider once it is active. It returns a function
that stops it. `setRoute(key)` sends a page view to each provider when the key
changes, and starts a new page session. Call it again after every client-side
navigation; on a site where every navigation loads a new page, the call above
is enough.

| Option | Type | Default | Description |
|---|---|---|---|
| `boot` | `{ mode?, timeoutMs? }` | `{ mode: 'immediate' }` | When providers start. See [Boot timing](/start/react/#boot-timing). |
| `autoShowBanner` | `boolean` | `true` | Whether `bannerVisible` becomes `true` when there is no stored choice. |
| `openConsentGlobalKey` | `string` | `'CONSENTLAYER_openConsent'` | The `window` function that opens the settings dialog, set by `start()`. |

## 2. Render the banner

The controller holds the state of a banner and a settings dialog.
`getSnapshot()` returns it, `subscribe(listener)` calls `listener` after each
change, and `actions` holds the functions that change it. The
[API reference](/reference/api/#createconsentcontrolleranalytics-options) lists
them.

```html
<section id="consent-banner" hidden>
  <p>We use cookies to run this site and, with your consent, for analytics.</p>
  <button type="button" data-action="rejectNonEssential">Reject non-essential</button>
  <button type="button" data-action="openDialog">Customize</button>
  <button type="button" data-action="acceptAll">Accept all</button>
</section>
<dialog id="consent-dialog">
  <form method="dialog">
    <div id="consent-categories"></div>
    <button type="button" data-action="closeDialog">Close</button>
    <button type="button" data-action="savePreferences">Save</button>
  </form>
</dialog>
<button type="button" id="cookie-settings" data-action="openDialog" hidden>Cookie settings</button>
```

```ts
// src/consent-banner.ts
import { controller } from './analytics'

const banner = document.getElementById('consent-banner')!
const dialog = document.getElementById('consent-dialog') as HTMLDialogElement
const settings = document.getElementById('cookie-settings')!
const list = document.getElementById('consent-categories')!

type Action = 'acceptAll' | 'rejectNonEssential' | 'savePreferences' | 'openDialog' | 'closeDialog'

function renderCategories() {
  const { categories, prefs } = controller.getSnapshot()
  list.replaceChildren(
    ...categories.map((category) => {
      const label = document.createElement('label')
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.checked = prefs[category]
      input.onchange = () =>
        controller.actions.setPrefs({ ...controller.getSnapshot().prefs, [category]: input.checked })
      label.append(input, ` ${category}`)
      return label
    }),
  )
}

function render() {
  const { ready, bannerVisible, dialogVisible } = controller.getSnapshot()
  banner.hidden = !ready || !bannerVisible || dialogVisible
  settings.hidden = !ready || bannerVisible
  if (dialogVisible && !dialog.open) {
    renderCategories()
    dialog.showModal()
  }
  if (!dialogVisible && dialog.open) dialog.close()
}

document.addEventListener('click', (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
  if (action) void controller.actions[action as Action]()
})
dialog.addEventListener('close', () => controller.actions.closeDialog())
controller.subscribe(render)
render()
```

The checkboxes are built when the dialog opens, so toggling one keeps the
keyboard focus. Give each category a visible label and description, as the
[recipe](/guides/consent-ui/#recipe) does. Closing the dialog with the Escape
key fires its `close` event, which keeps the controller in sync.

## 3. Track events

Import the instance wherever you track:

```ts
import { analytics } from './analytics'

document.querySelector('#sign-up')?.addEventListener('click', () => {
  void analytics.track('sign_up', { method: 'email' })
})
```

`analytics.consent.getConsent()` returns the current consent, `null` before a
choice, and `analytics.consent.subscribe(listener)` reports each change.
[Events and identity](/guides/events/) lists the standard events.

## Astro

In an Astro site, put the banner markup and the scripts in a component that
your layout renders on every page. Astro bundles each `<script>` as a module
and runs it once, so the instance and the controller are created once. Astro
exposes environment variables to the browser only with the `PUBLIC_` prefix,
so read `import.meta.env.PUBLIC_GA4_MEASUREMENT_ID` in `src/analytics.ts`.

With `<ClientRouter />` from `astro:transitions`, navigations no longer load a
new page. Report each one to the controller from the `astro:page-load` event,
and keep the banner across navigations with `transition:persist`:

```astro
---
// src/components/ConsentLayer.astro
---
<div transition:persist>
  <!-- the banner, dialog and settings button from step 2 -->
</div>

<script>
  import { controller } from '../analytics'
  import '../consent-banner'

  document.addEventListener('astro:page-load', () => {
    controller.setRoute(location.pathname + location.search)
  })
</script>
```

`astro:page-load` also fires for the first page; `setRoute()` ignores a call
with the key it already has, so that page view is not sent twice. Without
`<ClientRouter />`, the event never fires and the `setRoute()` call in
`src/analytics.ts` covers each page load.
