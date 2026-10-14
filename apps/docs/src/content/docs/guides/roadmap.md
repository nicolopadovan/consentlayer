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

### Website builders and CMS

Sites built without a JavaScript build step can't install an npm package. The
planned ports set ConsentLayer up where those sites add code:

| Platform | Planned port |
|---|---|
| WordPress | A plugin that loads the [script tag](/start/script-tag/) and takes the configuration in the WordPress admin. |
| Webflow | A snippet for the site's custom code settings. |
| Framer, Squarespace and Wix | A snippet for each platform's custom code settings. |
| Shopify themes | A theme app extension. In a headless storefront, `shopifyCustomerPrivacy()` already keeps Shopify's consent in sync. |
| Google Tag Manager | A community template that loads the script tag from a GTM container. |

## Under consideration

The following are not supported today. They are being considered, with no
commitment either way.

| Feature | Today |
|---|---|
| Google Ads | No provider. [`googleConsentMode()`](/guides/adapters/google-consent-mode/) sends it Consent Mode signals, but nothing loads the Google Ads tag or sends conversions. |
| Microsoft Clarity | No provider. Write one with [`definePlugin()`](/internals/plugins/). |
| PostHog feature flags and surveys | `posthog()` covers events, identity, groups, error tracking, autocapture and session recording, but not feature flags or surveys. |
| A setup CLI, after 1.0 | Setup is manual, following your framework's page under Getting started. A `consentlayer init` command would detect the framework, install the SDKs of the chosen providers, and write the instance, the provider setup and the consent banner into your project. Only `posthog()` and `sentry()` need an SDK installed; the other providers load their vendor's script in the browser. |
| A hosted consent service | Consent records are stored in your own database through a [store](/guides/consent-records/#stores). |
| Retention helpers | A `ConsentStore` only appends. Deleting old records is your application's job; see [Retention and deletion](/guides/consent-records/#retention-and-deletion). |

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
still runs before the defaults exist. Load such tags after your bundle, or
set the defaults yourself in an inline script before them.

</details>

