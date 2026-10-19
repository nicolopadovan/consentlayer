---
'consentlayer': minor
---

Add `consentlayer/banner`: `mountBanner(controller, options)` renders a consent banner, a settings dialog and a badge that reopens the settings on a consent controller, without a framework. The script-tag banner now uses it, and both gain:

- `position`: a card in any corner, centered at the top or bottom, or in the middle, or a bar across the top or bottom.
- `overlay` to dim the page, `blocking` to keep it from being used until the visitor chooses, and `closeButton` for an × that rejects non-essential categories.
- `emphasis`: Accept all and Reject non-essential look the same by default; `'accept'` fills only Accept all.
- `badge`, shown once a choice is stored by default, in a corner, at an edge's center or attached to the edge, with an optional label.
- `cookiePolicyUrl`, `termsUrl`, and text with `[label](url)` links, `**bold**` and the `{privacyPolicy}`, `{cookiePolicy}` and `{terms}` placeholders, plus the `dismiss`, `settingsMessage` and `badge` texts.
- `classNames` per part, for Tailwind or your own classes, and `unstyled`.

The banner follows the visitor's law. Region rules now come from laws, which the `consent.laws` option turns on or off: `gdpr` (the EU and EEA), `cnil` (France), `revfadp` (Switzerland) and `ccpa` (the United States) are on by default, and `uk`, `lgpd` (Brazil) and `quebec` are supported and off. The rules in force are those of 1.1.0, with France's six months now also covering its overseas departments and Saint-Martin. An unknown law name throws when the analytics instance is created. Where several laws apply, the stricter wins for each part. `RegionRule` gains `laws`, and the consent controller gains `laws`. Under each law, the banner:

- `gdpr`, `uk`, `lgpd`, `quebec`: asks before anything that needs consent runs, with Accept all and Reject non-essential alike.
- `cnil`: adds an × that refuses, with a message that says closing the banner refuses while the × shows, and asks again after six months.
- `revfadp`: shows a notice that offers Reject non-essential, with only Accept all filled.
- `ccpa`: shows no banner but a "Your Privacy Choices" badge with the California opt-out icon, always. It opens a dialog that states the right to opt out, with one switch, "Do not sell or share my personal information", that turns `marketing` off. Global Privacy Control turns it on, and the dialog then shows the new `gpcHonored` text, "Opt-Out Preference Signal Honored", which `''` hides; `doNotSell` relabels the switch.

The laws only fill in the banner options you leave unset: `emphasis`, `closeButton`, `badge` and `text` always win. The banner now renders once the controller is ready.

`analytics.consent.hasChoice()` and the consent controller's `chosen` tell a stored choice, from a consent platform too, from no choice, the region's defaults and a provisional answer, and the badge follows it. A choice that a consent platform reports as provisional and then confirms with the same consent is now stored.

The default colors now follow the page's `color-scheme`, and the font and text color are inherited from the page. The `save` text defaults to "Save choices". The script-tag banner now sits in the bottom-left corner by default; set `position: 'bottom-center'` or `data-position="bottom-center"` for the previous centered card.

The framework bindings mount the same banner with a component of their own, each in a separate entry point so that applications that build their own banner don't download it. The components take the same options and render the banner in the browser only:

- `consentlayer/react/banner`: `<ConsentBanner>`, inside `<AnalyticsProvider>` from `consentlayer/react` or `consentlayer/next`.
- `consentlayer/vue/banner`: `ConsentBanner`, with `app.use(consentLayer)` or in Nuxt.
- `consentlayer/svelte/banner`: the `consentBanner` action and `useConsentBanner()`.
- `consentlayer/solid/banner`: `<ConsentBanner>`, inside `<AnalyticsProvider>` from `consentlayer/solid` or `consentlayer/solidstart`.
- `consentlayer/angular/banner`: `provideConsentBanner()`, next to `provideConsentLayer()`.
