---
title: Script tag
description: Load ConsentLayer and a ready-made consent banner from a CDN with a script tag, configured on the page without a build step.
---

This guide sets up ConsentLayer on a site without a JavaScript build step: a
static site, a server-rendered page, or a CMS that lets you add code to the
page head. Two files ship in the `consentlayer` package for this, each a
single minified script:

| File | What it does |
|---|---|
| `dist/consentlayer.global.js` | Creates the instance and its consent controller from your configuration, with every browser provider included, and sends page views. |
| `dist/consentlayer-banner.global.js` | Renders a consent banner and a settings dialog on that controller. Optional: leave it out to [build your own](/start/javascript/#2-render-the-banner). |

## 1. Add the scripts

Load both from jsDelivr or unpkg, in the page `<head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/consentlayer@1/dist/consentlayer.global.js"></script>
<script src="https://cdn.jsdelivr.net/npm/consentlayer@1/dist/consentlayer-banner.global.js"></script>
```

```html
<script src="https://unpkg.com/consentlayer@1/dist/consentlayer.global.js"></script>
<script src="https://unpkg.com/consentlayer@1/dist/consentlayer-banner.global.js"></script>
```

`@1` serves the latest 1.x release, so fixes arrive without a change to your
page. To control upgrades, pin an exact version instead, such as
`consentlayer@1.0.0`. With an exact version you can also add
[Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity):
jsDelivr shows the `integrity` hash of each file on the package's page.

The two scripts load in either order, and work with `defer` or `async`. The
banner waits for the main script and for the document to be parsed.

## 2. Configure the providers and adapters

Configure ConsentLayer in one of two ways: a `window.ConsentLayer` object set
before the script runs, or `data-` attributes on the script tag.

### With `window.ConsentLayer`

```html
<script>
  window.ConsentLayer = {
    providers: {
      ga4: { measurementId: 'G-XXXXXXXXXX' },
      meta: { pixelId: '000000000000000' },
    },
    autoTracking: true,
  }
</script>
<script src="https://cdn.jsdelivr.net/npm/consentlayer@1/dist/consentlayer.global.js"></script>
```

`providers` maps a provider's name to the options of its factory, documented
on each [provider's page](/guides/providers/), and `adapters` does the same
for [consent adapters](/guides/adapters/). The other
keys are the options of
[`createAnalytics()`](/reference/api/#createanalyticsoptions), such as
`autoTracking`, `debug` and `consent`, and of
[`createConsentController()`](/reference/api/#createconsentcontrolleranalytics-options):
`boot`, `autoShowBanner` and `openConsentGlobalKey`. `banner` configures the
[banner](#3-the-banner).

| Name in `providers` | Provider | Notes |
|---|---|---|
| `ga4` | `ga4()` | |
| `meta` | `meta()` | |
| `tiktok` | `tiktok()` | |
| `contentsquare` | `contentsquare()` | |
| `hotjar` | `hotjar()` | Deprecated, like the npm provider. |
| `posthog` | `posthog()` | Loads PostHog from its CDN; see [PostHog and Sentry](#posthog-and-sentry). |
| `sentry` | `sentry()` | Loads Sentry from its CDN; see [PostHog and Sentry](#posthog-and-sentry). |
| `vercel` | `vercel()` | `trackEvent` defaults to `window.va`, set by the Vercel Analytics script. |

| Name in `adapters` | Adapter | Notes |
|---|---|---|
| `googleConsentMode` | `googleConsentMode()` | |
| `shopify` | `shopifyCustomerPrivacy()` | |
| `tcf` | `tcf()` | See [IAB TCF](#iab-tcf). |

```html
<script>
  window.ConsentLayer = {
    providers: { ga4: { measurementId: 'G-XXXXXXXXXX' } },
    adapters: { googleConsentMode: { regions: [{ region: ['US'], analytics: true }] } },
  }
</script>
```

An unknown name logs `[consentlayer] Unknown provider "<name>".` or
`[consentlayer] Unknown adapter "<name>".` and is skipped.

### With `data-` attributes

```html
<script
  src="https://cdn.jsdelivr.net/npm/consentlayer@1/dist/consentlayer.global.js"
  data-ga4="G-XXXXXXXXXX"
  data-meta-pixel="000000000000000"
  data-auto-tracking
></script>
```

| Attribute | Sets |
|---|---|
| `data-ga4` | `ga4.measurementId` |
| `data-gtm` | `gtm.containerId` |
| `data-meta-pixel` | `meta.pixelId` |
| `data-tiktok-pixel` | `tiktok.pixelId` |
| `data-contentsquare-tag` | `contentsquare.tagId` |
| `data-hotjar-site` | `hotjar.siteId` |
| `data-hotjar-version` | `hotjar.version` |
| `data-posthog-key` | `posthog.apiKey` |
| `data-posthog-host` | `posthog.apiHost` |
| `data-posthog-recording` | `posthog.recording` |
| `data-sentry-dsn` | `sentry.dsn` |
| `data-sentry-environment` | `sentry.environment` |
| `data-sentry-replay` | `sentry.replay` |
| `data-sentry-tracing` | `sentry.tracing` |
| `data-google-consent-mode` | The Google Consent Mode adapter, with no options |
| `data-shopify` | The Shopify Customer Privacy adapter, with no options |
| `data-tcf` | The IAB TCF adapter, with no options |
| `data-vercel` | `vercel()`, with no options |
| `data-auto-tracking` | `autoTracking` |
| `data-debug` | `debug` |

An attribute that sets a boolean is `true` when present, unless its value is
`"false"`. You can combine both ways: an attribute wins over the same option in
`window.ConsentLayer`, so a shared object can hold the options that have no
attribute.

### Page views

ConsentLayer sends a page view when the page loads and after every
`history.pushState()`, `history.replaceState()` and back or forward
navigation that changes the path or query string, so client-side routers need
no extra code. Each provider receives it once it is active, as in
[JavaScript and Astro](/start/javascript/#1-create-the-instance-and-the-controller).

### Events

Once the script has run, `window.ConsentLayer` is the analytics instance, with
its consent controller as `controller`. Send events with `track()`:

```html
<script>
  document.querySelector('#sign-up').addEventListener('click', () => {
    ConsentLayer.track('sign_up', { method: 'email' })
  })
</script>
```

`identify()`, `page()`, `consent` and the rest of the
[instance](/reference/api/#the-analytics-instance) work as they do from npm;
[Events and identity](/guides/events/) lists the event names. A script that
runs before ConsentLayer, such as one marked `async`, can wait for the
`consentlayer:ready` event on `window`.

## 3. The banner

`consentlayer-banner.global.js` shows a banner at the bottom of the page until
the visitor makes a choice, with three buttons: Reject non-essential,
Customize and Accept all. Customize opens a settings dialog with a toggle for
each category. The banner is labelled with its heading; the dialog is a modal
`<dialog>`, so it keeps focus inside while open, closes with Escape and
returns focus to the button that opened it.

The banner's default text and layout have not been legally reviewed. Whether
they are enough where you and your visitors are is your responsibility; see
the [legal notice](/guides/legal/).

To let visitors change their choice later, call `CONSENTLAYER_openConsent()`
from a link in your footer. The `openConsentGlobalKey` option renames it.

```html
<button type="button" onclick="CONSENTLAYER_openConsent()">Cookie settings</button>
```

### IAB TCF

With `adapters: { tcf: {} }` or `data-tcf`, the [IAB TCF adapter](/guides/adapters/tcf/) reads
the choice from the TCF CMP on the page. Keep loading the banner script: the
banner stays hidden while the CMP reports that GDPR applies, because the
adapter then always provides a choice, and shows as usual when there is no
CMP or the CMP reports `gdprApplies: false`. Link your footer to the CMP's
settings rather than to `CONSENTLAYER_openConsent()`, since a choice made in
ConsentLayer's dialog is not written back to the CMP.

### Text and privacy policy

The text is in English. Override any string, and add a link to your privacy
policy, with `window.ConsentLayer.banner` or with `data-` attributes on the
banner's script tag. An attribute wins.

```html
<script>
  window.ConsentLayer = {
    providers: { ga4: { measurementId: 'G-XXXXXXXXXX' } },
    banner: { privacyPolicyUrl: '/privacy', text: { title: 'Your privacy' } },
  }
</script>
```

```html
<script
  src="https://cdn.jsdelivr.net/npm/consentlayer@1/dist/consentlayer-banner.global.js"
  data-privacy-policy-url="/privacy"
  data-text-title="Your privacy"
></script>
```

| `text` key | `data-` attribute | Default |
|---|---|---|
| `title` | `data-text-title` | Cookies |
| `message` | `data-text-message` | We use cookies to run this site and, with your consent, for preferences, analytics and marketing. |
| `privacyPolicy` | `data-text-privacy-policy` | Privacy policy |
| `gpc` | `data-text-gpc` | Your browser's Global Privacy Control signal is on, so marketing is off unless you switch it on. |
| `rejectNonEssential` | `data-text-reject-non-essential` | Reject non-essential |
| `customize` | `data-text-customize` | Customize |
| `acceptAll` | `data-text-accept-all` | Accept all |
| `settingsTitle` | `data-text-settings-title` | Cookie settings |
| `necessaryLabel` | `data-text-necessary-label` | Necessary |
| `necessaryDescription` | `data-text-necessary-description` | Needed for the site to work, such as remembering this choice. Always on. |
| `preferencesLabel` | `data-text-preferences-label` | Preferences |
| `preferencesDescription` | `data-text-preferences-description` | Remember settings such as language or region. |
| `analyticsLabel` | `data-text-analytics-label` | Analytics |
| `analyticsDescription` | `data-text-analytics-description` | Help us understand how the site is used. |
| `marketingLabel` | `data-text-marketing-label` | Marketing |
| `marketingDescription` | `data-text-marketing-description` | Measure our ads and show relevant ones on other sites. |
| `close` | `data-text-close` | Close |
| `save` | `data-text-save` | Save |

The privacy policy link is shown only when `privacyPolicyUrl` is set. The
`gpc` line is shown under the message only while the visitor's browser sends
the [Global Privacy Control](/guides/consent-ui/#global-privacy-control)
signal; Accept all then leaves marketing off. Set
`window.ConsentLayer.consent.gpc` to `false` to ignore the signal.
A [custom category](/guides/consent-ui/#custom-categories) named in
`consent.categories` gets a toggle labelled with `<category>Label` and
`<category>Description`.

### Styling

The banner reads these CSS custom properties. Set them on `:root` or any
ancestor of `<body>`:

```css
:root {
  --consentlayer-accent: #4f46e5;
  --consentlayer-radius: 0;
}
```

| Property | Default |
|---|---|
| `--consentlayer-background` | `#fff` |
| `--consentlayer-color` | `#111827` |
| `--consentlayer-border` | `#e5e7eb` |
| `--consentlayer-radius` | `.75rem` |
| `--consentlayer-button-radius` | `.5rem` |
| `--consentlayer-accent` | `#111827`, for the primary buttons, checkboxes and focus ring |
| `--consentlayer-accent-color` | `#fff`, the text on primary buttons |
| `--consentlayer-font` | `.95rem/1.45 system-ui, sans-serif` |
| `--consentlayer-backdrop` | `rgb(0 0 0 / .3)`, behind the dialog |
| `--consentlayer-z-index` | `1000` |

For more, target the `.consentlayer-banner` and `.consentlayer-dialog`
classes.

## PostHog and Sentry

From npm, `posthog()` and `sentry()` import the vendor's SDK, which you
install. The script tag can't, so it loads each SDK from the vendor's CDN the
first time the provider needs it, under the same consent rules:

- PostHog: `array.js` from your region's assets host, derived from `apiHost`,
  for example `https://us-assets.i.posthog.com/static/array.js`. With
  `recording`, `lazy-recorder.js` from the same host.
- Sentry: `https://browser.sentry-cdn.com/11.7.0/bundle.tracing.replay.min.js`,
  one bundle with tracing and Replay. The version is pinned in each
  ConsentLayer release, so an upgrade of ConsentLayer is what moves it.

<details>
<summary>PostHog behind a reverse proxy</summary>

The assets host is derived by replacing `.i.posthog.com` in `apiHost` with
`-assets.i.posthog.com`. An `apiHost` on your own domain is left unchanged,
so your [reverse proxy](/guides/providers/posthog/#reverse-proxy) must also forward
`/static/` to PostHog's assets host, as PostHog's proxy guides describe.

</details>

## Content Security Policy

Add the CDN that serves ConsentLayer, `https://cdn.jsdelivr.net` or
`https://unpkg.com`, to `script-src`, along with the hosts of the providers
you use:

| Provider | `script-src` |
|---|---|
| GA4 | `https://www.googletagmanager.com` |
| Meta Pixel | `https://connect.facebook.net` |
| TikTok Pixel | `https://analytics.tiktok.com` |
| Contentsquare | `https://t.contentsquare.net` |
| Hotjar | `https://static.hotjar.com` |
| Shopify Customer Privacy | `https://cdn.shopify.com` |
| PostHog | `https://*.posthog.com`, or your reverse proxy |
| Sentry | `https://browser.sentry-cdn.com` |

The banner injects a `<style>` element. With a nonce-based `style-src`, put
the nonce on the banner's script tag: the banner copies it to the style.
[Installation](/start/installation/#content-security-policy) covers the
vendors' `connect-src` and `img-src` hosts.

## Example

`apps/example-html` in the repository has two pages, one configured with
`window.ConsentLayer` and one with `data-` attributes, both with the banner.
