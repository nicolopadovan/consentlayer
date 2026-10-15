---
'consentlayer': minor
---

Add `consentlayer/banner`: `mountBanner(controller, options)` renders a consent banner, a settings dialog and a badge that reopens the settings on a consent controller, without a framework. The script-tag banner now uses it, and both gain:

- `position`: a card in any corner, centered at the top or bottom, or in the middle, or a bar across the top or bottom.
- `overlay` to dim the page, `blocking` to keep it from being used until the visitor chooses, and `closeButton` for an × that rejects non-essential categories.
- `emphasis`: Accept all and Reject non-essential look the same by default; `'accept'` fills only Accept all.
- `badge`, shown after the choice by default, in a corner, at an edge's center or attached to the edge, with an optional label.
- `cookiePolicyUrl`, `termsUrl`, and text with `[label](url)` links, `**bold**` and the `{privacyPolicy}`, `{cookiePolicy}` and `{terms}` placeholders, plus the `dismiss`, `settingsMessage` and `badge` texts.
- `classNames` per part, for Tailwind or your own classes, and `unstyled`.

The default colors now follow the page's `color-scheme`, and the font and text color are inherited from the page. The `save` text defaults to "Save choices". The script-tag banner now sits in the bottom-left corner by default; set `position: 'bottom-center'` or `data-position="bottom-center"` for the previous centered card.

The framework bindings mount the same banner with a component of their own, each in a separate entry point so that applications that build their own banner don't download it. The components take the same options and render the banner in the browser only:

- `consentlayer/react/banner`: `<ConsentBanner>`, inside `<AnalyticsProvider>` from `consentlayer/react` or `consentlayer/next`.
- `consentlayer/vue/banner`: `ConsentBanner`, with `app.use(consentLayer)` or in Nuxt.
- `consentlayer/svelte/banner`: the `consentBanner` action and `useConsentBanner()`.
- `consentlayer/solid/banner`: `<ConsentBanner>`, inside `<AnalyticsProvider>` from `consentlayer/solid` or `consentlayer/solidstart`.
- `consentlayer/angular/banner`: `provideConsentBanner()`, next to `provideConsentLayer()`.
