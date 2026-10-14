---
title: Banner
description: Mount ConsentLayer's ready-made consent banner, settings dialog and reopen badge from npm or the script tag, and place, word and style them.
---

`consentlayer/banner` renders a consent banner, a settings dialog and a badge
that reopens the settings. It is the same banner the
[script tag](/start/script-tag/#3-the-banner) loads from the CDN, and it needs
no framework: it mounts on a consent controller from
[`createConsentController()`](/start/javascript/).

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

The banner shows while the controller's `bannerVisible` is `true`: with no
stored choice, or a [stale](/guides/consent-ui/#asking-again) one. It offers
Accept all, Reject non-essential and Customize. Customize opens the settings
dialog, a modal `<dialog>` with a switch for each category, which keeps focus
inside while open, closes with Escape and returns focus to the button that
opened it. Switches the visitor changes and then closes without saving are
discarded.

The React, Vue, Svelte, Solid and Angular bindings keep their controller
internal, so `mountBanner` does not work with them yet. Build the banner on
[`useConsentController()`](/guides/consent-ui/) instead, or follow the
[planned banner components](/guides/roadmap/#banner-components-for-ui-libraries).

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
the visitor chooses. Combine it with `overlay: true` to also dim the page, so
visitors can see why it does not respond.

Whether a site may be blocked until a choice is made depends on the law where
you and your visitors are. Check it before you turn this on; see the
[legal notice](/guides/legal/).

## Badge

After the visitor chooses, a round button with a cookie icon stays on the page
and reopens the settings. `badge: false` removes it; link to
`CONSENTLAYER_openConsent()` from your footer instead, as
[Reopening the settings](/guides/consent-ui/#reopening-the-settings) shows.

| Option     | Type                                                     | Default          | Description                                                                         |
| ---------- | -------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `show`     | `'after-choice' \| 'always'`                             | `'after-choice'` | `always` also shows it while the banner is open, beneath the banner.                |
| `position` | A corner, `top-center`, `bottom-center`, `left`, `right` | `'bottom-left'`  | Where the badge sits.                                                               |
| `label`    | `boolean`                                                | `false`          | Shows the `badge` text next to the icon. Without it, the text is the button's name. |
| `attached` | `boolean`                                                | `false`          | Sits flush against the nearest edge, the side edge for a corner.                    |

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
  become links; any other is shown as its label.
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
