# consentlayer

## 1.5.0

### Minor Changes

- e465ece: Auto-tracking now sends outbound link clicks, file downloads, site search, video engagement (`<video>` and YouTube embeds with `enablejsapi=1`) and form interactions to every provider, after analytics consent. All five are on by default, so an app that uses `autoTracking()` sends these events after upgrading; turn a kind off with, for example, `autoTracking({ forms: false })`. The GA4 provider and the Measurement Protocol destination send them, and scroll depth, under GA4's enhanced measurement names. The GA4 entry point exports `ga4Event`.
- 02129d3: The landing page's campaign parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` and `utm_id`) are kept in memory and added to the first page view each provider and server destination receives, so a visitor who consents on a later page is still attributed to the campaign. Nothing is stored before consent. The new `campaign` option adds parameter names with `params`, and `campaign: false` turns it off.
- 8a6c20a: Auto-tracking events carry `page_index`, the number of the page session in the current page load. `session_id` still carries the same value but is deprecated and will be removed in 2.0; it was never a session ID. A click on a link that sends `outbound_click` or `file_download` no longer also sends `ui_click`, unless the link has the tracking attribute.
- c56930f: Auto-tracking no longer sends `consentlayer.page_session_start` by default, because it duplicated the page view each provider already sends. Set `autoTracking({ pageViews: true })` to keep it. The other auto-tracking events still carry `session_id`.
- 0add146: Redaction replaces email addresses with `(redacted)` in page views, event params and the URLs providers and server destinations receive, and the new `redact.queryParams` option does the same for the values of chosen query parameters. It is on by default for email addresses, so a URL or param that contains one arrives as `(redacted)` after upgrading; `redact: false` turns it off. GA4, Google Ads, PostHog and Contentsquare also receive the redacted page URL or query string they would otherwise read themselves. `identify` and `group` data is never redacted. `PluginContext` gains `redact`, and `RedactOptions` is exported.

### Patch Changes

- bbc14ca: Deprecate `names.legacy` and `createEnvConfig`, both removed in 2.0. To keep moving stored consent from the `acm_*` keys, pass them as `legacyKeys` to `createLocalStorageConsentStorage()` and `createLocalStorageIdentityStorage()`; see the Names guide.

## 1.4.0

### Minor Changes

- 0e06d01: Add the Google Ads, Microsoft Clarity and LinkedIn Insight providers: `googleAds()` from `consentlayer/providers/google-ads`, `clarity()` from `consentlayer/providers/clarity` and `linkedin()` from `consentlayer/providers/linkedin`, also available in the script tag. Google Ads and LinkedIn need marketing consent and receive only the events mapped in their `events` option; Clarity needs analytics consent, takes the standard `events` list and follows every consent change through its consent API. gtag.js now loads once per page for all Google tags, and `ga4()` addresses its page views and events to its own measurement ID with `send_to`.

## 1.3.0

### Minor Changes

- 1931703: Add the `consentlayer/tanstack-start` and `consentlayer/astro` entry points. `consentlayer/tanstack-start` exports an `<AnalyticsProvider>` that sends a page view once each TanStack Router navigation has resolved, with the new path, query string and title; it needs `@tanstack/react-router` 1.29 or later, an optional peer dependency, and works with or without TanStack Start. `consentlayer/astro` exports `consentLayer(analytics, options?)`, which creates and starts a consent controller and sends a page view on every `astro:page-load` event, so page views follow `<ClientRouter />` navigations.

## 1.2.0

### Minor Changes

- d7d7c9a: Add `consentlayer/banner`: `mountBanner(controller, options)` renders a consent banner, a settings dialog and a badge that reopens the settings on a consent controller, without a framework. The script-tag banner now uses it, and both gain:

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

### Patch Changes

- d7d7c9a: The browser now keeps the event names a server route reports in `consentlayer-events`, and `consentlayer-forwarding: off`, in `sessionStorage` under `consentlayer_server:<endpoint>`. Later page loads in the same tab no longer post page views and session starts the route would drop before its first response. A response without `consentlayer-events` now lifts an earlier list.

## 1.1.0

### Minor Changes

- bdc67f2: Add rules per visitor region. Pass the region with `consent.region`, read on the server with `regionFromHeaders()` from `consentlayer/server` (Vercel, Cloudflare and Amazon CloudFront headers) or with `data-region` on the script tag. By default the US grants every category before a choice without a banner, with Global Privacy Control keeping marketing off; Switzerland grants preferences and analytics and still asks; France asks again after 180 days; every other region, and an unknown one, keeps the opt-in model. `consent.regions` adds or replaces rules, and `canadaRegions` and `ukStatisticsRegions` are available. `analytics.consent.getRegion()` and `shouldAsk()` expose the rule in force, and the consent controller's `bannerVisible` follows it.

## 1.0.0

### Major Changes

- 452d11b: First stable release. The public API now follows semantic versioning: breaking changes wait for 2.0.0. If you used a release candidate or the earlier internal package, follow [Migrating to 1.0](https://consentlayer.nicolopadovan.com/guides/migrating-to-v1/).

### Minor Changes

- 3bec6da: Every provider and server destination takes an `events` option: the event names `track()` sends to it, or `false` for none. Analytics providers receive every event by default. The Meta and TikTok pixels, `metaCapi` and `tiktokEvents` now receive only events that map to one of their standard events; custom and auto-tracking events reach them only when listed. An event whose `only` option names a provider is always sent to it.

  `autoTracking()` no longer takes `only`; use the providers' `events` option instead.

  Declare your own events in a `Register` interface (`declare module 'consentlayer' { interface Register { events: { … } } }`) to type their params. Once declared, `track()` rejects undeclared names.

- dfe1789: When a visitor grants marketing after analytics on the same route, the automatic page view now reaches marketing server destinations such as the Meta Conversions API, without being sent twice to those that already have it. `page()`'s `server` option accepts an array of categories, and `ServerEvent` has a `categories` field that `sendServerEvent` honors.
- dfe1789: Add a `nonce` option to `createAnalytics()`. ConsentLayer sets it on every script it injects, including the inline base code of `meta()` and `tiktok()`, for a Content Security Policy that allows scripts by nonce. The script-tag build reads it from its own `<script>` tag.
- dfe1789: `tcf()` no longer stores the denied state it reads while the CMP shows its interface, before the visitor has chosen. Consent adapters can answer `{ consent, provisional: true }` from `bootstrap()` for such a state: the engine applies it but does not store it. The new `ConsentBootstrapAnswer` type describes the answer.

### Patch Changes

- 2d887e6: `closeDialog()` now resets `prefs` to the stored choice, so toggles a visitor changed and then closed without saving are no longer granted by a later Save.
- 15982df: Export the `StoredConsent` type from `consentlayer`, so a custom `ConsentStorageAdapter` can name the record it reads and writes.
- fefddf8: A server destination's `events` option now covers `page_view` as well, so `metaCapi({ events: ['lead'] })` no longer receives page views. `createAnalyticsHandler` answers with a `consentlayer-events` header listing the event names its destinations take, and the browser then forwards only those events, plus events with `only`, instead of every event.

## 1.0.0-rc.2

### Patch Changes

- 15982df: Export the `StoredConsent` type from `consentlayer`, so a custom `ConsentStorageAdapter` can name the record it reads and writes.
- fefddf8: A server destination's `events` option now covers `page_view` as well, so `metaCapi({ events: ['lead'] })` no longer receives page views. `createAnalyticsHandler` answers with a `consentlayer-events` header listing the event names its destinations take, and the browser then forwards only those events, plus events with `only`, instead of every event.

## 1.0.0-rc.1

### Minor Changes

- 3bec6da: Every provider and server destination takes an `events` option: the event names `track()` sends to it, or `false` for none. Analytics providers receive every event by default. The Meta and TikTok pixels, `metaCapi` and `tiktokEvents` now receive only events that map to one of their standard events; custom and auto-tracking events reach them only when listed. An event whose `only` option names a provider is always sent to it.

  `autoTracking()` no longer takes `only`; use the providers' `events` option instead.

  Declare your own events in a `Register` interface (`declare module 'consentlayer' { interface Register { events: { … } } }`) to type their params. Once declared, `track()` rejects undeclared names.

- dfe1789: When a visitor grants marketing after analytics on the same route, the automatic page view now reaches marketing server destinations such as the Meta Conversions API, without being sent twice to those that already have it. `page()`'s `server` option accepts an array of categories, and `ServerEvent` has a `categories` field that `sendServerEvent` honors.
- dfe1789: Add a `nonce` option to `createAnalytics()`. ConsentLayer sets it on every script it injects, including the inline base code of `meta()` and `tiktok()`, for a Content Security Policy that allows scripts by nonce. The script-tag build reads it from its own `<script>` tag.
- dfe1789: `tcf()` no longer stores the denied state it reads while the CMP shows its interface, before the visitor has chosen. Consent adapters can answer `{ consent, provisional: true }` from `bootstrap()` for such a state: the engine applies it but does not store it. The new `ConsentBootstrapAnswer` type describes the answer.

### Patch Changes

- 70c4160: Updates development dependencies and fixes the lint errors the newer typescript-eslint reports. The script tag now binds `history.pushState` and `replaceState` once, with no change in behavior.

## 1.0.0-rc.0

The first public release.

### Consent

- `createAnalytics()` returns one instance with `track`, `page`, `identify`,
  `reset`, `group`, `captureError` and `consent`. Each provider runs only
  while its consent category is granted; calls made before boot are held and
  delivered in order.
- Categories `preferences`, `analytics` and `marketing`, plus typed custom
  categories declared in `ConsentCategories`.
- `createConsentController()` and each framework binding expose the state a
  banner needs; build your own banner on it.
- Re-consent after `consent.maxAgeDays` or a new major `consent.policyVersion`,
  with `onStale: 'discard' | 'keep'`.
- Global Privacy Control: while the browser sends it, `acceptAll()` leaves
  `marketing` denied; an explicit opt-in still wins. `consent.gpc: false`
  turns it off. The server follows each event's consent, which already
  reflects the signal.
- Consent records: `createConsentHandler()` appends each choice to Postgres,
  Supabase, Prisma, Drizzle or Upstash and sets a signed consent cookie, which
  `createAnalyticsHandler({ consentCookie })` uses to deny what the request
  body grants beyond it. A lost cookie is restored from the browser's stored choice.

### Consent adapters

- `tcf()` from `consentlayer/adapters/tcf` follows the choice an IAB TCF v2
  CMP collects, read-only, ahead of the stored choice.
- `shopifyCustomerPrivacy()` from `consentlayer/adapters/shopify` keeps
  Shopify's Customer Privacy API in sync, and loads it on headless
  storefronts.
- `googleConsentMode()` from `consentlayer/adapters/google-consent-mode` sends
  Consent Mode v2 signals to every Google tag, with region defaults,
  `waitForUpdate`, `urlPassthrough` and `adsDataRedaction`.

### Providers

- `ga4()`: Google Analytics 4 with Consent Mode v2, basic or advanced, and
  `serverContainerUrl` for server-side tagging.
- `gtm()`: a Google Tag Manager container, loaded after the Consent Mode
  defaults, fed page views, events, the user ID and consent changes through
  `dataLayer`. `requiredConsent` holds it until a category is granted, and
  `serverContainerUrl` loads it from your tagging server.
- `meta()`: the Meta Pixel with advanced matching and event IDs shared with
  the Conversions API.
- `tiktok()`: the TikTok Pixel with TikTok's consent mode and advanced
  matching.
- `posthog()`: cookieless until analytics consent; events, identity, groups,
  errors, and opt-in autocapture and session recording.
- `sentry()`: errors without consent or personal data; the user ID, Replay
  and tracing after analytics consent. `consentlayer/sentry/server` and
  `consentlayer/sentry/next` for Next.js.
- `contentsquare()`, `vercel()`, and `hotjar()` (deprecated in favor of
  `contentsquare()`).
- `definePlugin()` and `loadScript()` from `consentlayer`, and `checkPlugin()`
  from `consentlayer/testing`, for writing your own provider.
- Standard events with GA4 names, translated for each provider, and
  `productParams`, `cartParams` and `orderParams` in `consentlayer/ecommerce`.
- `autoTracking()` from `consentlayer/auto-tracking`: page sessions, scroll
  depth, time on page and clicks.
- `<MetaPixelNoscript>` and `<GtmNoscript>` render the vendors' `<noscript>`
  markup for visitors without JavaScript, opt-in.

### Server

- `createAnalyticsHandler()` forwards browser events to server destinations;
  `sendServerEvent()` sends server-only events such as webhooks. Both check
  the event's consent, hash email addresses and phone numbers, and run on edge runtimes.
- Destinations: `metaCapi()` (Meta Conversions API), `tiktokEvents()` (TikTok
  Events API), `sgtm()` (a server-side Google Tag Manager container) and
  `ga4Server()` (GA4 Measurement Protocol, server-only events).

### Frameworks

- `consentlayer/react` and `consentlayer/next` (App Router and Pages Router).
- `consentlayer/vue` and the `consentlayer/nuxt` module.
- `consentlayer/svelte` and `consentlayer/sveltekit`.
- `consentlayer/solid` and `consentlayer/solidstart`.
- `consentlayer/angular`.
- A script-tag build on jsDelivr and unpkg, configured with
  `window.ConsentLayer` or `data-` attributes, with an optional consent
  banner.

### Debugging

- `debug` logs consent changes, page views, events, provider lifecycle and
  errors; its object form picks topics and providers and takes your own
  logger. `onError` reports script-load failures and plugin errors.
