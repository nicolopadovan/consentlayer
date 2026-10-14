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

### Banner on npm: `consentlayer/banner`

The banner of the [script tag](/start/script-tag/#3-the-banner) is available
only from the CDN. The planned `consentlayer/banner` entry exports it for
applications that install ConsentLayer from npm, as a function that mounts it
on a consent controller.

### Banner components for UI libraries

The npm package ships no banner; you build one on
[`useConsentController()`](/guides/consent-ui/), starting from the recipe. The
planned components are first-party banners and settings dialogs built on the
UI libraries applications already use, so they match the rest of the
interface:

| Library                                | Planned component                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [shadcn/ui](https://ui.shadcn.com)     | A banner and dialog added with the shadcn CLI from a ConsentLayer registry, as source you own and restyle. The first to come. |
| shadcn-vue, shadcn-svelte and solid-ui | The same component for Vue, Svelte and Solid.                                                                                 |
| MUI, Mantine and Chakra UI             | Components for React applications built on them.                                                                              |
| Vuetify, Angular Material and others   | Components for the main UI library of each framework, added as there is demand.                                               |

### Adapters for consent platforms

Sites that already use a consent platform such as iubenda, Cookiebot, OneTrust
or Usercentrics can let it collect the choice and ConsentLayer follow it. Today
that works only through [`tcf()`](/guides/adapters/tcf/), when the platform
runs in IAB TCF mode, and only for the categories TCF purposes map to. The
planned [consent adapters](/guides/adapters/) read each platform's own
JavaScript API and events, so they work without TCF and map the platform's
categories directly.

### Website builders and CMS

Sites built without a JavaScript build step can't install an npm package. The
planned ports set ConsentLayer up where those sites add code:

| Platform                    | Planned port                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| WordPress                   | A plugin that loads the [script tag](/start/script-tag/) and takes the configuration in the WordPress admin.         |
| Webflow                     | A snippet for the site's custom code settings.                                                                       |
| Framer, Squarespace and Wix | A snippet for each platform's custom code settings.                                                                  |
| Shopify themes              | A theme app extension. In a headless storefront, `shopifyCustomerPrivacy()` already keeps Shopify's consent in sync. |
| Google Tag Manager          | A community template that loads the script tag from a GTM container.                                                 |

### Privacy laws beyond the GDPR

ConsentLayer's defaults follow the opt-in model of the EU's GDPR and ePrivacy
Directive: nothing that needs consent runs before the visitor gives it. They
have not been legally reviewed; see the [legal notice](/guides/legal/).
Other laws work differently, and the planned jurisdiction presets set the
consent model, the defaults and the signals to honor per visitor region:

| Law                                                | Planned                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US state laws, such as California's CCPA and CPRA  | An opt-out model: tracking until the visitor opts out of the sale or sharing of their data, through a "Do Not Sell or Share" choice or [Global Privacy Control](/guides/consent-ui/#global-privacy-control), which ConsentLayer already reads. |
| UK GDPR and PECR                                   | A preset for the UK's opt-in rules.                                                                                                                                                                                                            |
| Switzerland's Federal Act on Data Protection       | A preset for Swiss requirements.                                                                                                                                                                                                               |
| France, CNIL guidance                              | A preset for the CNIL's recommendations on cookies, such as how long a choice is kept.                                                                                                                                                         |
| Brazil's LGPD, Canada's PIPEDA and Quebec's Law 25 | Presets for each, after the ones above.                                                                                                                                                                                                        |

## Under consideration

The following are not supported today. They are being considered, with no
commitment either way.

| Feature                           | Today                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Ads                        | No provider. [`googleConsentMode()`](/guides/adapters/google-consent-mode/) sends it Consent Mode signals, but nothing loads the Google Ads tag or sends conversions.                                                                                                                                                                                                                                                                                               |
| Microsoft Clarity                 | No provider. Write one with [`definePlugin()`](/internals/plugins/).                                                                                                                                                                                                                                                                                                                                                                                                |
| PostHog feature flags and surveys | `posthog()` covers events, identity, groups, error tracking, autocapture and session recording, but not feature flags or surveys.                                                                                                                                                                                                                                                                                                                                   |
| A setup CLI, after 1.0            | Setup is manual, following your framework's page under Getting started. A `consentlayer init` command would detect the framework, install the SDKs of the chosen providers, and write the instance, the provider setup and the consent banner into your project. Only `posthog()` and `sentry()` need an SDK installed. `vercel()` calls the `track` function you pass from `@vercel/analytics`, and the other providers load their vendor's script in the browser. |
| A hosted consent service          | Consent records are stored in your own database through a [store](/guides/consent-records/#stores).                                                                                                                                                                                                                                                                                                                                                                 |
| Retention helpers                 | A `ConsentStore` only appends. Deleting old records is your application's job; see [Retention and deletion](/guides/consent-records/#retention-and-deletion).                                                                                                                                                                                                                                                                                                       |

## Known gaps

These are limits of the current release that are not tracked as planned work
above.

<details>
<summary>Global Privacy Control and IAB TCF are tested against their specifications</summary>

Global Privacy Control is tested with a simulated
`navigator.globalPrivacyControl`, not in a browser that sends the signal
itself. The [IAB TCF adapter](/guides/adapters/tcf/) is tested with a
simulated `__tcfapi`, not with a named CMP; its page lists its other
[limitations](/guides/adapters/tcf/#limitations).

</details>

<details>
<summary>Consent Mode defaults are set when your bundle runs</summary>

`ga4()` and the
[Google Consent Mode adapter](/guides/adapters/google-consent-mode/) set the
Consent Mode defaults when `createAnalytics()` creates the instance in the
browser, whatever the [`boot`](/start/react/#boot-timing) timing. A Google tag that runs before
your bundle, such as a Google Tag Manager snippet at the top of `<head>`,
still runs before the defaults exist. Load the container with
[`gtm()`](/guides/providers/gtm/), which sets the defaults first, load other
such tags after your bundle, or set the defaults yourself in an inline script
before them.

</details>
