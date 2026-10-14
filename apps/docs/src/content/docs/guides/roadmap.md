---
title: Roadmap
description: What ConsentLayer plans to add, what it is considering, and the known gaps in the current release, with workarounds.
---

This page describes where ConsentLayer is heading and where the current
release stops. It lists the work that is planned, the features under
consideration that are not supported today, and the known gaps in the current
behavior, each with a workaround where one exists. Target dates are plans,
not promises; each version's
[milestone on GitHub](https://github.com/nicolopadovan/consentlayer/milestones)
lists its issues, and the [changelog](/guides/changelog/) records what each release
actually ships.

## Planned

The sections below are ordered from the smallest change to the largest. The
[comparison with c15t](/guides/c15t/) explains where several of these come
from. Each ships in its own minor release, in order of priority:

| Item                                                                              | Priority | Target        |
| --------------------------------------------------------------------------------- | -------- | ------------- |
| [Privacy laws per visitor region](#privacy-laws-beyond-the-gdpr)                  | High     | December 2026 |
| [Banner translations](#banner-translations)                                       | High     | January 2027  |
| [shadcn/ui banner component](#banner-components-for-ui-libraries)                 | High     | January 2027  |
| [Astro and TanStack Start](#astro-and-tanstack-start)                             | Medium   | January 2027  |
| [Google Ads, Microsoft Clarity and LinkedIn Insight](#more-providers)             | Medium   | February 2027 |
| [Embeds behind consent](#embeds-behind-consent)                                   | Medium   | March 2027    |
| [Viewing and exporting consent records](#viewing-and-exporting-consent-records)   | Medium   | March 2027    |
| [The other planned providers](#more-providers)                                    | Medium   | Q2 2027       |
| [Adapters for consent platforms](#adapters-for-consent-platforms)                 | Medium   | Q2 2027       |
| [Detailed settings dialog](#detailed-settings-dialog)                             | Medium   | Q2 2027       |
| [Rich banner text](#rich-banner-text)                                             | Low      | Q2 2027       |
| [Banner components for other UI libraries](#banner-components-for-ui-libraries)   | Low      | Q3 2027       |
| [Native banner components per framework](#banner-components-for-ui-libraries)     | Low      | Q3 2027       |
| [Website builders and CMS](#website-builders-and-cms)                             | Low      | Q3 2027       |
| [A hosted consent service](#a-hosted-consent-service)                             | Medium   | Q4 2027       |
| [A full IAB TCF and GPP consent manager](#a-full-iab-tcf-and-gpp-consent-manager) | Low      | 2028          |

### Banner translations

The [banner](/guides/banner/) is in English; each string can
be overridden, but no other language ships. The planned translations cover the
banner's text in the main European languages and beyond, chosen from the
page's `lang` attribute or set explicitly, and are used by the banner
components below.

### Banner components for UI libraries

The [banner](/guides/banner/) ships for every framework binding as a thin
component that mounts the same banner, built from plain DOM elements rather
than your framework's templates. The planned native components render the
banner and settings dialog in each framework's own templates, so you can
compose and restyle them like the rest of your components. The planned
library components are first-party banners and settings dialogs built on the
UI libraries applications already use, so they match the rest of the
interface:

| Library                                | Planned component                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [shadcn/ui](https://ui.shadcn.com)     | A banner and dialog added with the shadcn CLI from a ConsentLayer registry, as source you own and restyle. The first to come. |
| shadcn-vue, shadcn-svelte and solid-ui | The same component for Vue, Svelte and Solid.                                                                                 |
| MUI, Mantine and Chakra UI             | Components for React applications built on them.                                                                              |
| Vuetify, Angular Material and others   | Components for the main UI library of each framework, added as there is demand.                                               |

### Astro and TanStack Start

Astro and TanStack Start applications can use `consentlayer` and the
[JavaScript setup](/start/javascript/) today, without a dedicated
integration. The planned bindings send page views on their client-side
navigation, as the other framework integrations do.

### More providers

ConsentLayer has [9 providers](/guides/providers/). The planned ones cover
the tools that other consent tools already load:

| Kind         | Planned providers                                                                 |
| ------------ | --------------------------------------------------------------------------------- |
| Advertising  | Google Ads, LinkedIn Insight, Microsoft Advertising (UET), Reddit, Snapchat and X |
| Analytics    | Microsoft Clarity, Mixpanel, Amplitude, Plausible, Matomo and Segment             |
| Support chat | Intercom and Crisp                                                                |

Until a provider exists, write it with [`definePlugin()`](/internals/plugins/).
The advertising providers that have a server API, such as Google Ads
conversions, also get a server destination.

### Embeds behind consent

ConsentLayer controls scripts it loads itself. Embedded content such as
YouTube videos and Google Maps sets cookies of its own as soon as its iframe
loads. The planned embed helper holds each embed behind a placeholder until
its consent category is granted, or until the visitor allows it on the
placeholder.

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

### Viewing and exporting consent records

[Consent records](/guides/consent-records/) are appended to your database,
and reading them is left to you. The planned helpers look up a visitor's
records by `consentId` or `userId`, export them for a data subject request,
and delete records older than a retention period you set.

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
| Brazil's LGPD, Canada's PIPEDA and Quebec's Law 25 | Presets for each.                                                                                                                                                                                                                              |

Applying a preset per region needs the visitor's region. The planned region
lookup reads it on the server, from the country and region headers your host
or CDN adds, and passes it to the browser with the page. It comes with a
one-line setup for the most used hosts: Vercel, Cloudflare, Netlify and AWS
CloudFront. No IP address is stored. A visitor whose region is unknown gets
the strictest rules, the EU's opt-in model, so a site that doesn't set up the
lookup keeps today's behavior. The presets and the region lookup ship
together, in one release.

### A hosted consent service

Consent records are stored in your own database through a
[store](/guides/consent-records/#stores), and the region lookup needs a server
that renders the page. The planned hosted service removes both requirements:
it stores consent records, reads the visitor's region from the request and
returns the rules that apply, so a static site or a single-page application
can use per-region rules without a server of its own. A dashboard shows the
records and exports them. Running the same backend on your own
infrastructure stays supported.

### A full IAB TCF and GPP consent manager

The [`tcf()`](/guides/adapters/tcf/) adapter only reads the choice of an IAB
TCF consent manager on the page. A full implementation would make
ConsentLayer that consent manager: its banner would show the vendors and
purposes of the Global Vendor List and write the TC string, and it would
answer the IAB's Global Privacy Platform (GPP) API for US and other
regional frameworks. Each site that uses it must be covered by a CMP
registered with IAB Europe, which charges a fee and reviews the banner, so
this comes last.

### Detailed settings dialog

The settings dialog has one switch per category. The planned dialog adds, under
each category, an expandable list of the providers it covers, with each
provider's name, purpose and link to its privacy policy, taken from the
providers you configured. It then adds a switch per provider, so a visitor
can allow Google Analytics but not Hotjar, for example. Choices per provider
need a change to the consent state, which today stores one flag per category,
and to how providers check their consent requirement.

### Rich banner text

Banner text supports `[label](url)` links, `**bold**` and the
`{privacyPolicy}`, `{cookiePolicy}` and `{terms}` placeholders. Two further
forms are planned for content those do not cover:

- **DOM nodes.** Each text option also accepts a `Node`, such as a
  `DocumentFragment` you build, which the banner inserts as it is. This is
  available from JavaScript only, since a script tag's `data-` attributes hold
  strings.
- **Trusted HTML.** Each text option also accepts `{ html: '…' }`, and the
  script tag a `data-text-*-html` attribute. The banner inserts the HTML
  without sanitizing it, so it must come from your own code and never from
  visitors, a CMS that others edit, or another untrusted source. The explicit
  `html` wrapper keeps that choice visible where the text is written. Where
  the page enforces Trusted Types, the value must be a `TrustedHTML` object.

## Under consideration

The following are not supported today. They are being considered, with no
commitment either way.

| Feature                           | Today                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostHog feature flags and surveys | `posthog()` covers events, identity, groups, error tracking, autocapture and session recording, but not feature flags or surveys.                                                                                                                                                                                                                                                                                                                                   |
| A setup CLI, after 1.0            | Setup is manual, following your framework's page under Getting started. A `consentlayer init` command would detect the framework, install the SDKs of the chosen providers, and write the instance, the provider setup and the consent banner into your project. Only `posthog()` and `sentry()` need an SDK installed. `vercel()` calls the `track` function you pass from `@vercel/analytics`, and the other providers load their vendor's script in the browser. |
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
