# Changelog

All notable changes to `@nicolopadovan/analytics-consent-manager` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
