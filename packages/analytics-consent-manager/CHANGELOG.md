# Changelog

All notable changes to `@nicolopadovan/analytics-consent-manager` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Breaking. See [docs/migrating-to-v1.md](../../docs/migrating-to-v1.md).

### Breaking
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

### Added
- `definePlugin`, `loadScript`, `getFlag` / `setFlag` for plugin authors, and
  `checkPlugin()` in `/testing`, which every built-in passes. The manager runs
  `setup` → `consent` → `load` (once) and `teardown` on withdrawal.
- `requiredConsent: 'none'` for cookieless providers.
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

### Fixed
- `ConsentEngine.bootstrap()` runs once even when called from several places.
- `newPageSession()` no longer sends a page-session event before auto-tracking is enabled.
- Auto-tracking could start before providers were active and lose the first page-session event.

### Changed
- `IdentityStorageAdapter.write` replaces the stored identity instead of
  merging; `clear` also removes the legacy `acm_*` key.
- Default names use the `npcm` prefix: `npcm_consent`, `npcm_user_identity`,
  `npcm:consent`, `NPCM_CONSENT`, `NPCM_openConsent`, `.npcm-*` classes,
  `--npcm-*` variables and `__npcm*` provider window flags.
- Auto-tracking events are renamed to `npcm.page_session_start`,
  `npcm.scroll_depth`, `npcm.time_on_page` and `npcm.ui_click`. **Breaking** for
  dashboards filtering on `acm.*`.
- `defaultRuntimePreset` now reads the configured names.
- `ConsentBroadcastConfig.eventName` / `globalKey` accept an array.
- `:root { --npcm-* }` overrides now apply; previously the component defaults
  shadowed variables set on ancestors.

### Added
- `configureNames({ prefix, classPrefix, legacy, ...overrides })` and `getNames()`.
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
