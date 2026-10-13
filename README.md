# consentlayer

Monorepo for the [`consentlayer`](./packages/consentlayer) package and its example Next.js consumer.

## Quick Links

- [Docs index](./docs/README.md)
- [Installation](./docs/installation-and-access.md)
- [Next.js integration](./docs/nextjs-integration.md)
- [Events and identity](./docs/events.md)
- [Migrating to v1](./docs/migrating-to-v1.md)
- [Provider configuration](./docs/provider-configuration.md)
- [Server-side tracking](./docs/server-side-tracking.md)
- [Publishing and releases](./docs/publishing-and-releases.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Support](./SUPPORT.md)

## Package

- Package name: `consentlayer`
- Registry: [npmjs.com](https://www.npmjs.com/package/consentlayer)
- Repository: [github.com/nicolopadovan/analytics-consent-manager-npm](https://github.com/nicolopadovan/analytics-consent-manager-npm)
- Example consumer: [`apps/example-next`](./apps/example-next)

## Install

```bash
pnpm add consentlayer
```

Provider SDKs are optional peer dependencies; see [installation](./docs/installation-and-access.md).

## Repo Layout

- [`packages/consentlayer`](./packages/consentlayer): publishable package
- [`apps/example-next`](./apps/example-next): reference consumer and route examples
- [`.github/workflows/publish-package.yml`](./.github/workflows/publish-package.yml): npm publish workflow

## Publish Flow

1. Update the version in [`packages/consentlayer/package.json`](./packages/consentlayer/package.json).
2. Merge to `main`.
3. Run the `Publish Package` workflow or publish a GitHub release.

Details live in [publishing and releases](./docs/publishing-and-releases.md).

## UI Theming

The headless components (`CookieBanner`, `CookieDialog`, `ManageConsentTrigger`)
ship with stable BEM-style class names. A default theme is published at
`consentlayer/ui/styles.css` and is **opt-in** —
import it to get a usable look, skip it to stay fully unstyled.

```ts
// app/layout.tsx
import 'consentlayer/ui/styles.css'
```

The defaults are driven by CSS custom properties. Override at any selector to
re-theme without forking the markup:

```css
:root {
  --cl-accent: #3b82f6;       /* primary button background */
  --cl-accent-fg: #ffffff;    /* primary button text */
  --cl-bg: #0f172a;           /* surface background */
  --cl-fg: #e2e8f0;           /* surface text */
  --cl-border: #1e293b;
  --cl-radius: 8px;
  --cl-padding: 16px;
  --cl-z-index: 9999;
}
```

Available variables:

| Variable | Default | Purpose |
|---|---|---|
| `--cl-bg` | `#ffffff` | Surface background (banner & dialog) |
| `--cl-fg` | `#111827` | Body text colour |
| `--cl-muted` | `#6b7280` | Secondary text |
| `--cl-border` | `#e5e7eb` | Borders, hairlines |
| `--cl-accent` | `#111827` | Primary button background |
| `--cl-accent-fg` | `#ffffff` | Primary button text |
| `--cl-danger` | `#b91c1c` | Error message colour |
| `--cl-radius` | `12px` | Surface corner radius |
| `--cl-radius-button` | `8px` | Button corner radius |
| `--cl-padding` | `20px` | Surface inner padding |
| `--cl-gap` | `12px` | Vertical rhythm between blocks |
| `--cl-shadow` | (soft drop) | Surface shadow |
| `--cl-font-family` | system stack | Font family |
| `--cl-z-index` | `1000` | Banner stacking context |

If you need deeper control, target the classes directly:

| Component | Root class | Notable child classes |
|---|---|---|
| `CookieBanner` | `.cl-banner` | `.cl-banner__title`, `.cl-banner__description`, `.cl-banner__link`, `.cl-banner__error`, `.cl-banner__actions`, `.cl-banner__button`, `.cl-banner__button--primary`, `.cl-banner__button--secondary` |
| `CookieDialog` | `.cl-dialog` | `.cl-dialog__title`, `.cl-dialog__option`, `.cl-dialog__checkbox`, `.cl-dialog__option-label`, `.cl-dialog__option-description`, `.cl-dialog__link`, `.cl-dialog__actions`, `.cl-dialog__button`, `.cl-dialog__button--primary` |
| `ManageConsentTrigger` | `.cl-manage-trigger` | — |

Pre-rc.2 names (`--acm-*` variables, `.acm-*` classes) still work: the
components emit both classes and the stylesheet matches both. Pass
`configureNames({ classPrefix })` to change the emitted class prefix.

## UI Language

The components ship English and Italian. The language is the first of:

1. `<AnalyticsProvider locale="it">`
2. `createAnalytics({ locale })`; `createEnvConfig` reads it from `NEXT_PUBLIC_ANALYTICS_LOCALE`
3. `<html lang>`
4. English

`it-CH` uses `it`. Any string can be replaced, and any language added, with
`messages`; missing strings fall back to the built-in text, then English:

```tsx
<AnalyticsProvider
  analytics={analytics}
  privacyPolicyUrl="/privacy"
  messages={{
    it: { acceptAll: 'Va bene' },
    de: { acceptAll: 'Alle akzeptieren', rejectNonEssential: 'Nur notwendige' },
  }}
>
```

The keys are in the exported `ConsentMessages` type.

## Names

Every storage key, global, DOM event, auto-tracking event and CSS class
prefix comes from one place. Defaults use the `consentlayer` prefix:

| Name | Default |
|---|---|
| consent storage key | `consentlayer_consent` |
| identity storage key | `consentlayer_user_identity` |
| consent DOM event | `consentlayer:consent` |
| consent global | `window.CONSENTLAYER_CONSENT` |
| open-dialog global | `window.CONSENTLAYER_openConsent()` |
| auto-tracking events | `consentlayer.page_session_start`, `consentlayer.scroll_depth`, `consentlayer.time_on_page`, `consentlayer.ui_click` |
| UI class prefix | `cl-` |

Change them with `createAnalytics({ names })` (or `configureNames()` before
the first consent read):

```ts
createAnalytics({
  providers,
  names: {
    prefix: 'shop',                     // shop_consent, shop:consent, SHOP_CONSENT, …
    consentStorageKey: 'my_consent',    // any single name can be overridden
    classPrefix: 'shop',                // .shop-banner, .shop-dialog, …
    legacy: true,                       // also read and write the acm_* names below
  },
})
```

### Migrating from `acm_*`

Until 1.0.0-rc.1 the prefix was `acm`. With `legacy: true`:

- a stored `acm_consent` / `acm_user_identity` value is moved to the new key on first read;
- `acm:consent` is dispatched and `ACM_CONSENT` / `ACM_openConsent` are set alongside the new names;
- provider window flags are read and written under both `__consentlayer*` and `__acm*`;
- `.acm-*` classes and `--acm-*` variables keep working.

Auto-tracking events are renamed outright (`acm.*` → `consentlayer.*`), so dashboards
filtering on the old names need updating.

## Security & Secrets

The server-side helpers in this package accept credentials that must never
reach the browser bundle.

- `apiSecret` (GA4 Measurement Protocol) — pass via a server-only environment
  variable. Treat it like any other API key.
- `accessToken` (Meta Conversions API) — same rules. Required scope is
  `ads_management` or a system-user token; rotate when team members leave.

### Do this

```ts
// app/api/analytics/route.ts — server-only
import { createAnalyticsHandler } from 'consentlayer/server'
import { metaCapi } from 'consentlayer/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [
    metaCapi({
      pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID!,
      accessToken: process.env.META_TOKEN!,
    }),
  ],
})
```

The browser only knows the route: `createAnalytics({ server: { endpoint: '/api/analytics' } })`.
See [server-side tracking](./docs/server-side-tracking.md).

### Never do this

```ts
// Anything imported into client code ships in the browser bundle.
'use client'
metaCapi({ pixelId, accessToken: 'EAAB…' })
```

If you're using Next.js, prefer `NEXT_PUBLIC_*` only for the values that are
genuinely safe to expose (the GA4 measurement ID and Meta pixel ID are public
identifiers and may be inlined). The `apiSecret` and `accessToken` must stay
in non-prefixed env vars accessed only inside Route Handlers, Server Actions,
or other server-only code paths.

See [`SECURITY.md`](./SECURITY.md) for the responsible-disclosure process.
