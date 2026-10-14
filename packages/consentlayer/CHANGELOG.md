# Changelog

All notable changes to `consentlayer` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Breaking. See [Migrating to v1](https://consentlayer.vercel.app/guides/migrating-to-v1/).

### Breaking
- Consent adapters have their own entry points, `consentlayer/adapters/*`:
  the Shopify Customer Privacy adapter moved from `consentlayer/providers/shopify`.
  The script tag takes adapters under `adapters`, next to `providers`.
- `tiktok()` takes `{ pixelId, loadBeforeConsent? }` and loads the TikTok
  pixel itself. The consent-only mode, which forwarded
  `ttq('consent', …)` to a `ttq` the app loaded, is removed; drop your own
  TikTok base code.
- An `autoTracking` object that turns on a kind, with `true` or its options,
  enables only the kinds it turns on, like `debug`. An object that turns none
  on, such as `{ scroll: false }`, still enables every other kind.
- The consent storage key holds `{ consent, updatedAt, policyVersion }`
  instead of the bare `ConsentState`; values stored the old way are still read.
  `ConsentStorageAdapter.read()` and `write()` take this `StoredConsent` record.
  `window.CONSENTLAYER_CONSENT` and the `consentlayer:consent` event are
  unchanged.
- `consentlayer/ui` (`CookieBanner`, `CookieDialog`, `ManageConsentTrigger`,
  the stylesheet and messages) is removed. Build your banner on
  `useConsentController()`, starting from the copy-paste recipe in the docs.
  `names.classPrefix` and `createAnalytics({ locale })` go with it.
- `consent.setConsent()` rejects with a `TypeError` unless `preferences`,
  `analytics` and `marketing` are booleans; `null` used to be ignored and
  strings such as `'false'` counted as granted.
- "Reject non-essential" now stores `preferences: false`; it used to grant
  preferences. `CookieDialog` gains a Preferences toggle, and Save stores it.
- `configureNames()` is no longer exported; pass `createAnalytics({ names })`.
  `createAnalytics()` without `names` now resets them to the defaults.
- `names.legacy` defaults to `false`: the `acm_*` names are no longer read or
  written unless you pass `names: { legacy: true }`.
- `ga4()` and `meta()` default to `loadBeforeConsent: false`: no script loads
  until the category is granted.
- Removed from the root entry: the validators (`isValid*`, `assertValid*`,
  `*HttpsOrRelativeUrl`), `legacyNames`, `defaultRuntimePreset` (use `getNames()`)
  and the `ConsentEngine`, `ConsentEngineOptions`, `AnalyticsManager` and
  `AnalyticsManagerOptions` types. `analytics.consent.destroy` is gone; call
  `analytics.destroy()`.
- `/server` keeps only `createAnalyticsHandler`, `sendServerEvent` and their
  types; `/server/meta` and `/server/ga4` keep only `metaCapi` and `ga4Server`.
  The low-level helpers (`createMetaEventPayload`, `sendMetaCapiEvent`, `sha256`,
  `assertSameOrigin`, `parseJsonWithLimit`, the GA4 Measurement Protocol helpers…)
  are gone. Hashing uses WebCrypto, so the server entries run on the edge runtime.
- `metaCapi` defaults to Graph API v26.0 (v18.0 was retired by Meta) and takes
  `apiVersion`.
- Removed the `shopify()` plugin: its events went to a queue no Shopify script
  reads. `createShopifyCustomerPrivacyAdapter` stays.
- `MetaPixelNoscript` moved from `consentlayer/providers/meta` to
  `consentlayer/react`, so the Meta provider no longer imports React;
  `renderMetaPixelNoscriptHtml` is removed.
- `consentlayer/sentry/next` exports `withSentryConfig` instead of `withSentry`.
- Renamed from `@nicolopadovan/analytics-consent-manager` (GitHub Packages) to
  `consentlayer` on npmjs.com. Default names use `consentlayer` (`consentlayer_consent`,
  `consentlayer:consent`, `CONSENTLAYER_CONSENT`, `consentlayer.*` auto-tracking
  events) and `cl` for CSS (`.cl-*`, `--cl-*`).
- One instance replaces the module singletons: `createAnalytics({ providers, consent, autoTracking, names })`
  returns `track`, `page`, `identify`, `reset`, `group`, `consent.update` and friends.
  Removed `createAnalyticsManager`, `createConsentEngine`, the default runtime
  (`trackEvent`, `trackPage`, `updateConsent`, `registerProvider`, `enableAutoTracking`,
  `newPageSession`, `setDefault*`, `getDefault*`) and `saveIdentity` / `getIdentity`.
- React: `<AnalyticsProvider analytics>` replaces `ConsentProvider`,
  `ConsentControllerProvider`, `AnalyticsManager` and `AutoTracking`;
  `useAnalytics()` replaces `useTracker()`.
- Standard events use GA4 names (`view_item`, `add_to_cart`, `purchase`, …) and
  each provider translates them. The `trackViewContent`-style helpers are replaced
  by `productParams`, `cartParams` and `orderParams` in `/ecommerce`.
- `TrackEventOptions.sendTo` → `only`; `defaultEventDestinations` removed.
- `AnalyticsEventPayload` has a required `id`; `metaEventIdFrom` removed.
- `UserIdentity.external_id` → `userId` (stored `external_id` values are still read).
- `track` no longer requires analytics consent by default; each provider's own
  consent category decides. `page`, `identify` and `group` now check it too.
- Plugin contract: `ProviderAdapter` → `AnalyticsPlugin`, `AnalyticsProviderContext`
  → `PluginContext`; hooks `init` → `load`, `onConsentChange` → `consent`,
  `trackPage` → `page`, `trackEvent` → `track`; `enabled` and `ctx.isBooted`
  removed; `loadBeforeConsent` is a plugin field. A plugin without
  `requiredConsent` runs without consent. Error scopes renamed to match.
- Provider factories renamed: `ga4()`, `meta()`, `hotjar()`, `shopify()`,
  `tiktok()`, `vercel()`. `vercel()` no longer requires analytics consent.
- `meta()` loses `serverEndpoint` and `fetchImpl`: browser → server forwarding
  moved to `createAnalytics({ server: { endpoint } })`, which posts a new
  event shape for `createAnalyticsHandler`.

### Added
- Global Privacy Control: while `navigator.globalPrivacyControl` is `true`,
  `acceptAll()` leaves `marketing` denied; an explicit `marketing: true` still
  wins. `consent.gpc: false` ignores the signal. `analytics.consent.gpc` and
  the consent controller's `gpc` (in every framework binding) say whether it
  is honored, and the script-tag banner shows a `gpc` text line.
- `createTcfAdapter()` from `consentlayer/adapters/tcf` reads the visitor's
  choice from an IAB TCF v2 CMP through `__tcfapi` and follows its updates.
  TCF purposes map to categories (overridable with `purposes`); only consent
  counts, not legitimate interest. Read-only. Returns no choice without a CMP
  or when GDPR does not apply. The script tag takes it as `adapters: { tcf: {} }` or `data-tcf`.
- `tiktok({ pixelId })` loads the TikTok pixel after marketing consent, with
  TikTok's consent mode (`holdConsent`, `grantConsent`, `revokeConsent`), and
  sends page views, events with `event_id` and advanced matching through
  `ttq.identify`. `toTikTokEvent` maps standard events to TikTok's.
- `tiktokEvents()` from `consentlayer/server/tiktok` sends events to the TikTok
  Events API under marketing consent, deduplicated against the pixel by the
  shared event ID.
- A script-tag build, `dist/consentlayer.global.js`, served from jsDelivr and
  unpkg: every browser provider in one file, configured with
  `window.ConsentLayer` or `data-` attributes on the script tag, with page
  views on load and on history navigation. PostHog and Sentry load from their
  vendor's CDN. See [Script tag](https://consentlayer.vercel.app/start/script-tag/).
- A consent banner for the script tag, `dist/consentlayer-banner.global.js`:
  a banner and a settings dialog with a toggle per category, English text
  overridable per string, a privacy policy link and `--consentlayer-*` CSS
  custom properties.
- `createConsentController(analytics, options?)` is exported from
  `consentlayer`: what the React provider and the Vue plugin do, without a
  framework, for plain JavaScript and Astro sites.
- `debug` logs every page view and event each provider receives, provider
  lifecycle and `boot`, alongside consent changes and errors, and says when a
  call reaches no provider, is held until boot or is dropped by `enabled`. An object form,
  `debug: { consent, events, providers, errors, only, logger }`, picks topics
  and providers and sends entries to your own logger. `PluginContext.log`
  logs on behalf of a plugin.
- `consentlayer/vue`: the `consentLayer` plugin boots the instance, sends a
  page view per Vue Router navigation, reports errors from
  `app.config.errorHandler`, and provides `useAnalytics()`, `useConsent()` and
  `useConsentController()`.
- `consentlayer/nuxt`: a Nuxt 4 module that creates the instance from
  `app/consentlayer.config.ts` (`defineConsentLayerConfig()`), installs the Vue
  plugin with Nuxt's router, reports component errors through Nuxt's
  `vue:error` hook, and auto-imports the composables and `<MetaPixelNoscript>`.
- `consentlayer/svelte`: `consentLayer()` in the root component boots the
  instance, sends page views, and provides `useAnalytics()`, `useConsent()`
  and `useConsentController()` with the state as reactive properties.
- `consentlayer/sveltekit`: the same, with page views per SvelteKit navigation,
  and `handleErrorWith(analytics)` for the client `handleError` hook.
- `consentlayer/solid`: `<AnalyticsProvider>`, `useAnalytics()`,
  `useConsent()`, `useConsentController()` and an `<ErrorBoundary>` that
  reports to `captureError`, as in React.
- `consentlayer/solidstart`: the same, with page views per Solid Router
  navigation, sent once the browser's URL has changed.
- `consentlayer/angular`: `provideConsentLayer()` boots the instance, sends a
  page view per Angular Router navigation, and reports errors from Angular's
  `ErrorHandler`; `injectAnalytics()`, `injectConsent()` and
  `injectConsentController()` provide the state as signals, and
  `provideMetaPixelNoscript()` adds Meta's `<noscript>` pixel to server-rendered
  HTML.
- `<MetaPixelNoscript>` is exported from `consentlayer/vue`, `consentlayer/svelte`,
  `consentlayer/sveltekit`, `consentlayer/solid` and `consentlayer/solidstart`
  too, not only `consentlayer/react`.
- `createAnalytics({ consent: { maxAgeDays, policyVersion, onStale } })` asks
  the visitor again when the stored choice is older than `maxAgeDays` or was
  made under another major `policyVersion` (`'3.x'` to `'4.0'`).
  `onStale: 'discard'` (default) treats it as no choice; `'keep'` keeps it in force while the banner is shown.
  `analytics.consent.isStale()` reports it.
- `ga4({ consentMode: 'advanced' })` configures the tag at boot so Google
  receives cookieless pings while consent is denied. The Consent Mode update
  is no longer sent before the visitor's first choice.
- `googleConsentMode()` from `consentlayer/adapters/google-consent-mode`, a
  consent adapter that sends Consent Mode v2 signals to every Google tag, with
  or without `ga4()`: `regions` sets defaults per ISO 3166-2 region in
  ConsentLayer categories; `waitForUpdate`, `urlPassthrough` and
  `adsDataRedaction` map to Google's settings. With it, `ga4()` leaves Consent
  Mode to the adapter. The script tag takes it as
  `adapters: { googleConsentMode }` or `data-google-consent-mode`.
- `ConsentIntegrationAdapter.observe(consent)` runs when the engine is created
  and after every consent change, whatever its source.
- A lost consent cookie is restored: `createAnalyticsHandler({ consentCookie })`
  answers `consentlayer-consent: missing` when the cookie is missing or
  invalid, and the browser posts its stored choice to `server.consentEndpoint`
  once per page load. `ConsentRecord` gains `restored`, so SQL tables need a
  `restored boolean not null default false` column.
- `createAnalyticsHandler` answers `consentlayer-forwarding: off` when it has
  no destination, for example a `metaCapi()` without its token, and the browser
  stops forwarding `page()` and `track()` to it until the page is reloaded.
- `consentlayer/next` works in the Pages Router: render its `<AnalyticsProvider>`
  in `pages/_app.tsx`. Page views wait for `router.isReady`.
- `consentlayer/next`: an `AnalyticsProvider` for the App Router that sends a
  page view on every navigation, query changes included. It replaces the
  `usePathname()` / `useSearchParams()` shell, whose `<Suspense>` around the
  whole page made Next.js render every page on the client only.
- `ga4()`, `meta()`, `posthog()`, `sentry()`, `contentsquare()` and `hotjar()`
  accept an `undefined` or empty ID and turn the provider off (logged with
  `debug: true`), so `process.env` values can be passed without guards.
  Malformed IDs still throw. `hotjar()` also accepts its IDs as strings of digits.
- `metaCapi()` and `ga4Server()` return `undefined` while an ID or secret is
  unset, warning once when only one of the two is set, and `destinations`
  skips `undefined` entries.
- `<MetaPixelNoscript>` renders nothing while `pixelId` is unset.
- Provider IDs and server destination credentials are trimmed, so a trailing
  newline in an environment variable no longer throws.
- `server.endpoint` and `server.consentEndpoint` treat `''` as unset.
- `consentCookie.secret` accepts `undefined`: `createAnalyticsHandler` warns once
  and treats every event as denied.
- The Shopify adapter loads Shopify's Customer Privacy script itself on
  headless storefronts, once `storefrontAccessToken` is set.
- `useConsentController()` returns `categories`, the categories the dialog shows.
- The Shopify adapter sends `headlessStorefront` only once
  `storefrontAccessToken` is set.
- `requestInfo(request)` is exported from `consentlayer/server`, for
  `sendServerEvent({ request })`.
- `<AnalyticsProvider routeKey={null}>` holds page views until the route is known.
- `useAnalytics()`, `useConsent()` and `ErrorBoundary` work outside
  `<AnalyticsProvider>`, using the instance `createAnalytics()` made.
- `createAnalytics()` warns when a second instance on the page uses different
  names.
- Consent records: `createAnalytics({ server: { consentEndpoint } })` posts
  each choice to `createConsentHandler`, which appends a record (consent ID,
  time, choices, policy version, user ID) to Postgres, Supabase, Prisma,
  Drizzle or Upstash and sets a signed cookie. `createAnalyticsHandler({
  consentCookie })` then takes consent from that cookie instead of the body.
- Custom consent categories: declare them in `ConsentCategories` and pass
  `createAnalytics({ categories })`; any plugin can require one, and
  `analytics.consent.categories` lists them all. A Shopify or other adapter
  choice no longer resets categories it doesn't know.
- `contentsquare()` provider (`consentlayer/providers/contentsquare`).
- `tunnel` on `sentry()` and `uiHost` on `posthog()`, for reverse proxies.
- `onError` reports a second provider with an `id` already in use (scope
  `provider-setup`), and the first call dropped by a full 100-call queue (scope
  `queue-full`).
- `definePlugin`, `loadScript`, `getFlag` / `setFlag` for plugin authors, and
  `checkPlugin()` in `/testing`, which every built-in passes. The manager runs
  `setup` → `consent` → `load` (once) and `teardown` on withdrawal.
- `requiredConsent: 'none'` for cookieless providers.
- Server: `createAnalyticsHandler` (one web-standard route that forwards browser
  events to Meta CAPI), `sendServerEvent` for webhook events, and the
  destinations `metaCapi` (`/server/meta`) and `ga4Server` (`/server/ga4`).
  Each checks the consent sent with the event, hashes personal data and reads
  `_fbp` / `_fbc` / `_ga`. GA4 receives server-only events, with the
  Measurement Protocol `consent` field.
- `createAnalytics({ server: { endpoint } })` forwards `track` and `page` with
  their event ID; page views reach Meta CAPI as `PageView`.
- Page views carry an ID (`page.id`) that Meta uses as `eventID`.
- Typed `StandardEvents` params; `providers: { [id]: extras }` per-event option.
- `identify(userId, traits)`, `reset()`, `group(id, traits)` and matching
  optional provider hooks. GA4 sets `user_id`; Hotjar identifies without email
  or phone; providers that load later receive the stored user ID.
- Meta translation (`toMetaEvent`): `items[]` → `content_ids` / `contents`.
- GA4: `lead` → `generate_lead`; invalid characters in event names become `_`.
- `consent.update(partial)` merges into the current consent.
- `autoTracking` option starts auto-tracking once analytics consent is granted;
  `autoTracking.only` limits which providers receive auto-tracked events.
- Meta: `customize_product`, `schedule`, `submit_application`, `find_location`,
  `donate`; Meta standard names passed as is stay standard; content IDs use the
  variant ID when present.
- Hotjar `reset()`; on analytics withdrawal Hotjar's cookies and storage are
  deleted (its script recreates them until reload), and `reloadOnRevoke: true`
  reloads the page so recording stops.
- Email and phone are kept in memory until marketing consent, then stored and
  shared with GA4 (`user_data`), Meta (pixel advanced matching at start, server
  mirror) and Hotjar; consent without marketing deletes them and clears them
  from GA4. Stored email or phone from before is used only if the stored
  consent includes marketing. A Meta pixel started with them stays off after
  a withdrawal until the next page load.
- `track`, `page`, `identify` and `group` calls made before boot are held and
  delivered in order right after it; `requireAnalyticsConsent` /
  `requireMarketingConsent` are checked at delivery.
- `page(payload, { only })`. `AnalyticsProvider` sends the current page to a
  provider that starts later on the same route (e.g. Meta after marketing consent).
- `posthog()` (`/providers/posthog`): cookieless until analytics consent, then
  cookies; events, page views, identify, group, reset and errors. Autocapture
  and session recording are opt-in.
- `sentry()` (`/providers/sentry`): errors without consent or personal data;
  the user ID, Replay and tracing (both opt-in) after analytics consent.
  `/sentry/server` (`sentryInstrumentation` for `instrumentation.ts`) and
  `/sentry/next` (`withSentryConfig`) for Next.js.
- `captureError(error, { level, tags, extra })`, the plugin `error` hook and the
  `errors` option; window `error` and `unhandledrejection` are reported by default.
- React: `ErrorBoundary` and `createGlobalError(analytics)` for `app/global-error.tsx`.
- `defer` on any plugin: load when idle, on the first interaction or after a delay.
- `posthog-js`, `@sentry/browser`, `@sentry/nextjs`, `react` and `react-dom` are
  optional peer dependencies; each feature's SDK code is a separate chunk loaded on use.

### Deprecated
- `hotjar()`: Hotjar accounts are moving to Contentsquare; use `contentsquare()`.
- `createEnvConfig()`: pass `process.env` values to the providers directly.

### Fixed
- With a deferred boot, a Google tag on the page could run before `ga4()` set
  the Consent Mode defaults. Plugin `setup` hooks now run when the instance is
  created in the browser, before boot, instead of at boot.
- `captureError` reports each error object once, so an error that reaches both
  a framework's error handler and the window's `error` event is not sent twice.
- `debug` logs `reached no provider` when the providers a call reaches have no
  hook for it, such as `captureError` with only GA4 and Meta; it logged nothing.
- Bundlers built on esbuild, such as Angular's and Vite's dependency
  pre-bundling, warned that `consentlayer` imported its own chunks for side
  effects; the build no longer emits those imports.
- A consent adapter whose `bootstrap()` failed left `consent.bootstrap()` and
  every later `consent.update()` rejected; the error now goes to `onError` and
  the next adapter is asked.
- The Shopify adapter's `apply` resolved before Shopify's callback.
- Safari dropped the `Secure` consent cookie on `http://localhost`; it is no
  longer `Secure` on localhost.
- A missing consent secret reports `the consent secret is not set` instead of
  the 32-character message.
- `createConsentHandler()` stored the record and then answered 500 without a
  cookie when the secret was shorter than 32 characters. It and
  `createAnalyticsHandler({ consentCookie })` now check the secret first on
  each request: a missing or short one answers 500 and stores nothing.
- `createAnalytics({ consent: { categories, onError } })` was silently replaced
  by the top-level options; the types now reject both keys inside `consent`.
- `ConsentEngine.bootstrap()` runs once even when called from several places.
- `newPageSession()` no longer sends a page-session event before auto-tracking is enabled.
- Auto-tracking could start before providers were active and lose the first page-session event.
- `loadScript` added a relative `src` again on every call, and a call made while
  the script was loading resolved before it ran.
- Shopify bootstrap stored an undecided `sale_of_data` as `false`.
- `ga4Server` hashed invalid emails and phone numbers; it now applies the same
  checks as `metaCapi` and leaves them out.

### Changed
- `IdentityStorageAdapter.write` replaces the stored identity instead of
  merging; `clear` also removes the legacy `acm_*` key.
- Default names use the `consentlayer` prefix: `consentlayer_consent`, `consentlayer_user_identity`,
  `consentlayer:consent`, `CONSENTLAYER_CONSENT`, `CONSENTLAYER_openConsent`, `.cl-*` classes,
  `--cl-*` variables and `__consentlayer*` provider window flags.
- Auto-tracking events are renamed to `consentlayer.page_session_start`,
  `consentlayer.scroll_depth`, `consentlayer.time_on_page` and `consentlayer.ui_click`. **Breaking** for
  dashboards filtering on `acm.*`.
- `defaultRuntimePreset` now reads the configured names.
- `ConsentBroadcastConfig.eventName` / `globalKey` accept an array.
- `:root { --cl-* }` overrides now apply; previously the component defaults
  shadowed variables set on ancestors.

### Added
- `configureNames({ prefix, legacy, ...overrides })` and `getNames()`.
- Legacy compatibility (on by default, `legacy: false` to disable): stored
  `acm_*` values move to the new keys on first read; `acm:consent`,
  `ACM_CONSENT` and `ACM_openConsent` keep being set; `.acm-*` classes and
  `--acm-*` variables keep working; `__acm*` window flags are read and written.
- `createLocalStorage*Storage({ legacyKeys })` to migrate from other keys.
- `loadBeforeConsent` option on `createGa4Adapter` and `createMetaAdapter`
  (default `true`). `false` loads nothing until the category is granted.

## [1.0.0-rc.1] — 2026-05-11

### Added
- `AutoTrackingConfig` — granular per-feature control over auto-tracking. Pass to
  `manager.enableAutoTracking(config)` or `<AutoTracking config={...} />`.
  - `clicks`: `boolean | { mode: 'all' | 'attribute', attribute?, selectors? }`.
    Default `'all'` matches every clickable element; switch to `'attribute'` to
    only fire for elements bearing a `data-track` (or custom) attribute.
  - `scroll`: `boolean | { thresholds: number[] }` — replace the default
    `[25, 50, 75, 100]` with any depths you want, or disable entirely.
  - `timeOnPage`: `boolean | { intervals: number[] }` — replace the default
    `[5, 15, 30, 60, 120]` seconds, or disable.
  - `pageViews`: `boolean` — toggle the `acm.page_session_start` marker event.
- `useTracker()` React hook returning `{ trackEvent, trackPage, newPageSession }`
  so consumers don't have to thread the manager through their component tree.
- Public type exports: `AutoTrackingConfig`, `AutoTrackingClickConfig`,
  `AutoTrackingClickMode`, `AutoTrackingScrollConfig`, `AutoTrackingTimeConfig`.

### Changed
- `enableAutoTracking()` with no arguments still produces the previous behaviour
  (all clicks, scroll 25/50/75/100, time 5/15/30/60/120, page-session marker).
  Backwards-compatible.

## [1.0.0-rc.0] — 2026-05-11

### Added
- `onError` callback on `AnalyticsManagerOptions` so consumers can route adapter
  failures (script-load errors, lifecycle exceptions) to their own logger.
- `AnalyticsProviderContext.emitError` — providers can report async failures
  (e.g. a script tag firing `onerror`) back through the manager's `onError`.
- New `AnalyticsError`, `AnalyticsErrorHandler`, and `AnalyticsErrorScope` types.
- Validation helpers exported from the package root: `isValidGa4MeasurementId`,
  `assertValidGa4MeasurementId`, `isValidMetaPixelId`, `assertValidMetaPixelId`,
  `isHttpsOrRelativeUrl`, `assertHttpsOrRelativeUrl`, `isValidEmail`,
  `isValidPhoneE164`.
- Meta Pixel adapter attaches `onerror` to the `fbevents.js` script tag and
  emits a `provider-script-load` error if the CDN load fails.
- GA4 adapter attaches `onerror` to the `gtag.js` script tag with the same
  semantics.

### Changed
- `createGa4Adapter` and `createMetaAdapter` now **throw at construction**
  when given an invalid measurement ID, pixel ID, or non-HTTPS server endpoint.
  Bad configuration fails loudly instead of silently producing dead events.
- `normalizeIdentity` now drops invalid emails and phone numbers instead of
  passing them through. Invalid identifiers will no longer be SHA-256 hashed
  and sent to Meta CAPI as silent garbage.
- Server-side `createMetaEventPayload` applies the same email/phone validation
  as a defence-in-depth check.

### Security
- README now documents that `GA4 apiSecret` and `Meta CAPI accessToken` must be
  loaded from server-only environment variables. They must never be bundled
  into the browser. See the **Security & Secrets** section in the README.

## [0.1.0] — 2026-04-?

Initial preview release. Core consent engine, analytics manager, provider
adapters (GA4, Meta, Shopify, Hotjar, TikTok, Vercel), React bindings, headless
UI components, and server-side helpers for Meta CAPI and GA4 Measurement
Protocol.
