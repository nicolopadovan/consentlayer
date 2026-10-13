# Analytics Consent Manager

Private monorepo for `@nicolopadovan/analytics-consent-manager` and its example Next.js consumer.

## Quick Links

- [Docs index](./docs/README.md)
- [Installation and access](./docs/installation-and-access.md)
- [Next.js integration](./docs/nextjs-integration.md)
- [Provider configuration](./docs/provider-configuration.md)
- [Server-side tracking](./docs/server-side-tracking.md)
- [Publishing and releases](./docs/publishing-and-releases.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Support](./SUPPORT.md)

## Package

- Package name: `@nicolopadovan/analytics-consent-manager`
- Registry: `https://npm.pkg.github.com`
- Repository: [github.com/nicolopadovan/analytics-consent-manager-npm](https://github.com/nicolopadovan/analytics-consent-manager-npm)
- Example consumer: [`apps/example-next`](./apps/example-next)

## Install

GitHub Packages local installs require a classic GitHub PAT with `read:packages`.

```ini
@nicolopadovan:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_CLASSIC_PAT
always-auth=true
```

```bash
pnpm add @nicolopadovan/analytics-consent-manager
```

See [installation and access](./docs/installation-and-access.md) for the full setup.

## Repo Layout

- [`packages/analytics-consent-manager`](./packages/analytics-consent-manager): publishable package
- [`apps/example-next`](./apps/example-next): reference consumer and route examples
- [`.github/workflows/publish-package.yml`](./.github/workflows/publish-package.yml): private package publish workflow

## Publish Flow

1. Update the version in [`packages/analytics-consent-manager/package.json`](./packages/analytics-consent-manager/package.json).
2. Push to `main`.
3. Run the `Publish Package` workflow or publish a GitHub release.

Details live in [publishing and releases](./docs/publishing-and-releases.md).

## UI Theming

The headless components (`CookieBanner`, `CookieDialog`, `ManageConsentTrigger`)
ship with stable BEM-style class names. A default theme is published at
`@nicolopadovan/analytics-consent-manager/ui/styles.css` and is **opt-in** —
import it to get a usable look, skip it to stay fully unstyled.

```ts
// app/layout.tsx
import '@nicolopadovan/analytics-consent-manager/ui/styles.css'
```

The defaults are driven by CSS custom properties. Override at any selector to
re-theme without forking the markup:

```css
:root {
  --npcm-accent: #3b82f6;       /* primary button background */
  --npcm-accent-fg: #ffffff;    /* primary button text */
  --npcm-bg: #0f172a;           /* surface background */
  --npcm-fg: #e2e8f0;           /* surface text */
  --npcm-border: #1e293b;
  --npcm-radius: 8px;
  --npcm-padding: 16px;
  --npcm-z-index: 9999;
}
```

Available variables:

| Variable | Default | Purpose |
|---|---|---|
| `--npcm-bg` | `#ffffff` | Surface background (banner & dialog) |
| `--npcm-fg` | `#111827` | Body text colour |
| `--npcm-muted` | `#6b7280` | Secondary text |
| `--npcm-border` | `#e5e7eb` | Borders, hairlines |
| `--npcm-accent` | `#111827` | Primary button background |
| `--npcm-accent-fg` | `#ffffff` | Primary button text |
| `--npcm-danger` | `#b91c1c` | Error message colour |
| `--npcm-radius` | `12px` | Surface corner radius |
| `--npcm-radius-button` | `8px` | Button corner radius |
| `--npcm-padding` | `20px` | Surface inner padding |
| `--npcm-gap` | `12px` | Vertical rhythm between blocks |
| `--npcm-shadow` | (soft drop) | Surface shadow |
| `--npcm-font-family` | system stack | Font family |
| `--npcm-z-index` | `1000` | Banner stacking context |

If you need deeper control, target the classes directly:

| Component | Root class | Notable child classes |
|---|---|---|
| `CookieBanner` | `.npcm-banner` | `.npcm-banner__title`, `.npcm-banner__description`, `.npcm-banner__error`, `.npcm-banner__actions`, `.npcm-banner__button`, `.npcm-banner__button--primary`, `.npcm-banner__button--secondary` |
| `CookieDialog` | `.npcm-dialog` | `.npcm-dialog__title`, `.npcm-dialog__option`, `.npcm-dialog__checkbox`, `.npcm-dialog__actions`, `.npcm-dialog__button`, `.npcm-dialog__button--primary` |
| `ManageConsentTrigger` | `.npcm-manage-trigger` | — |

Pre-rc.2 names (`--acm-*` variables, `.acm-*` classes) still work: the
components emit both classes and the stylesheet matches both. Pass
`configureNames({ classPrefix })` to change the emitted class prefix.

## Names

Every storage key, global, DOM event, auto-tracking event and CSS class
prefix comes from one place. Defaults use the `npcm` prefix:

| Name | Default |
|---|---|
| consent storage key | `npcm_consent` |
| identity storage key | `npcm_user_identity` |
| consent DOM event | `npcm:consent` |
| consent global | `window.NPCM_CONSENT` |
| open-dialog global | `window.NPCM_openConsent()` |
| auto-tracking events | `npcm.page_session_start`, `npcm.scroll_depth`, `npcm.time_on_page`, `npcm.ui_click` |
| UI class prefix | `npcm-` |

Change them before the first consent read, e.g. at the top of the module that
sets up analytics:

```ts
import { configureNames } from '@nicolopadovan/analytics-consent-manager'

configureNames({
  prefix: 'shop',                       // shop_consent, shop:consent, SHOP_CONSENT, …
  consentStorageKey: 'my_consent',      // any single name can be overridden
  classPrefix: 'shop',                  // .shop-banner, .shop-dialog, …
  legacy: false,                        // drop the acm_* compatibility below
})
```

### Migrating from `acm_*`

Until 1.0.0-rc.1 the prefix was `acm`. While `legacy` is on (the default):

- a stored `acm_consent` / `acm_user_identity` value is moved to the new key on first read;
- `acm:consent` is dispatched and `ACM_CONSENT` / `ACM_openConsent` are set alongside the new names;
- provider window flags are read and written under both `__npcm*` and `__acm*`;
- `.acm-*` classes and `--acm-*` variables keep working.

Auto-tracking events are renamed outright (`acm.*` → `npcm.*`), so dashboards
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
// app/api/track/route.ts (Next.js Route Handler)
import { sendGa4MeasurementEvent } from '@nicolopadovan/analytics-consent-manager/server'

export async function POST(request: Request) {
  await sendGa4MeasurementEvent({
    measurementId: process.env.GA4_MEASUREMENT_ID!,
    apiSecret: process.env.GA4_API_SECRET!, // server-only
    payload: await request.json(),
  })
  return new Response(null, { status: 204 })
}
```

### Never do this

```ts
// Don't inline secrets, even in "private" code — bundlers ship this to the browser.
const adapter = createMetaAdapter({
  pixelId: '123456789012345',
  serverEndpoint: 'https://graph.facebook.com/...',
  // The browser bundle MUST NOT contain the CAPI access token.
})
```

If you're using Next.js, prefer `NEXT_PUBLIC_*` only for the values that are
genuinely safe to expose (the GA4 measurement ID and Meta pixel ID are public
identifiers and may be inlined). The `apiSecret` and `accessToken` must stay
in non-prefixed env vars accessed only inside Route Handlers, Server Actions,
or other server-only code paths.

See [`SECURITY.md`](./SECURITY.md) for the responsible-disclosure process.
