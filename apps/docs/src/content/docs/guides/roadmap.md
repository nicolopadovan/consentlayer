---
title: Roadmap
description: What ConsentLayer plans to add, what it is considering, and the known gaps in the current release, with workarounds.
---

This page describes where ConsentLayer is heading and where the current
release stops. It lists the work that is planned, the features under
consideration that are not supported today, and the known gaps in the current
behavior, each with a workaround where one exists. Items carry no dates or
target versions; the [changelog](/guides/changelog/)
records what each release actually ships.

## Planned

Ordered from the smallest change to the largest.

### TikTok pixel

Today `tiktok()` only forwards consent to a `ttq` your application loads
itself: it calls `ttq('consent', 'grant')` when `marketing` is granted and
`ttq('consent', 'reject')` otherwise. The planned provider loads the TikTok
pixel once `marketing` is granted and sends page views and events, like
`meta()` does for the Meta Pixel.

### TikTok Events API

`consentlayer/server` has destinations for Meta, `metaCapi()`, and GA4,
`ga4Server()`. The planned `tiktokEvents()` destination sends server events to
the TikTok Events API under `marketing` consent, sharing each event's ID with
the [TikTok pixel](#tiktok-pixel) so TikTok can deduplicate the two.

### Script-tag build

The package ships ES modules only, so it needs a bundler. The planned build is
a single file you load with a `<script>` tag from a CDN, configured on the page
without a build step. It is what the [website builder and CMS
ports](#website-builders-and-cms) build on.

### Vue, Svelte, Solid and Angular

The core runs in any browser code, but React is the only binding. Today, in
other frameworks, use `createAnalytics()` and `analytics.consent` directly and
build the banner state yourself. The planned bindings provide the equivalent of
`<AnalyticsProvider>`, `useConsent()` and `useConsentController()` for Vue 3,
Svelte 5, SolidJS and Angular, and send a page view on every navigation with
Nuxt, SvelteKit, SolidStart and the Angular Router, like `consentlayer/next`
does for Next.js.

### Website builders and CMS

Sites built without a JavaScript build step can't install an npm package. The
planned ports set ConsentLayer up where those sites add code:

| Platform | Planned port |
|---|---|
| WordPress | A plugin that loads the script-tag build and takes the configuration in the WordPress admin. |
| Webflow | A snippet for the site's custom code settings. |
| Framer, Squarespace and Wix | A snippet for each platform's custom code settings. |
| Shopify themes | A theme app extension. In a headless storefront, `createShopifyCustomerPrivacyAdapter()` already keeps Shopify's consent in sync. |
| Google Tag Manager | A community template that loads the script-tag build from a GTM container. |

## Under consideration

The following are not supported today. They are being considered, with no
commitment either way.

| Feature | Today |
|---|---|
| Google Ads | No provider. Only `ga4()` sends Consent Mode commands. |
| Microsoft Clarity | No provider. Write one with [`definePlugin()`](/internals/plugins/). |
| IAB TCF | ConsentLayer does not read or write a TCF consent string. |
| PostHog feature flags and surveys | `posthog()` covers events, identity, groups, error tracking, autocapture and session recording, but not feature flags or surveys. |
| A bundled consent banner | ConsentLayer ships no UI. The [Consent UI](/guides/consent-ui/) guide provides a banner to copy and restyle. |
| A hosted consent service | Consent records are stored in your own database through a [store](/guides/consent-records/#stores). |
| Global Privacy Control | ConsentLayer does not read `navigator.globalPrivacyControl`, so a visitor who sends the signal sees the banner like any other. Some US state privacy laws require treating the signal as an opt-out of sale or sharing. |
| Retention helpers | A `ConsentStore` only appends. Deleting old records is your application's job; see [Retention and deletion](/guides/consent-records/#retention-and-deletion). |

## Known gaps

These are limits of the current release that are not tracked as planned work
above.

<details>
<summary>Consent Mode defaults are set when the instance boots</summary>

`ga4()` sets the Consent Mode defaults in its `setup` hook, which runs at
`analytics.boot()`. If you defer boot, for example with `boot={idleBoot}`,
another Google tag on the page, such as one loaded by Google Tag Manager, can
run before the defaults exist. If your page loads other Google tags, boot
without a delay or set the defaults yourself in an inline script before those
tags.

</details>

