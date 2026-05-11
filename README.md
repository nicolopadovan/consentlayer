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
  --acm-accent: #3b82f6;       /* primary button background */
  --acm-accent-fg: #ffffff;    /* primary button text */
  --acm-bg: #0f172a;           /* surface background */
  --acm-fg: #e2e8f0;           /* surface text */
  --acm-border: #1e293b;
  --acm-radius: 8px;
  --acm-padding: 16px;
  --acm-z-index: 9999;
}
```

Available variables:

| Variable | Default | Purpose |
|---|---|---|
| `--acm-bg` | `#ffffff` | Surface background (banner & dialog) |
| `--acm-fg` | `#111827` | Body text colour |
| `--acm-muted` | `#6b7280` | Secondary text |
| `--acm-border` | `#e5e7eb` | Borders, hairlines |
| `--acm-accent` | `#111827` | Primary button background |
| `--acm-accent-fg` | `#ffffff` | Primary button text |
| `--acm-danger` | `#b91c1c` | Error message colour |
| `--acm-radius` | `12px` | Surface corner radius |
| `--acm-radius-button` | `8px` | Button corner radius |
| `--acm-padding` | `20px` | Surface inner padding |
| `--acm-gap` | `12px` | Vertical rhythm between blocks |
| `--acm-shadow` | (soft drop) | Surface shadow |
| `--acm-font-family` | system stack | Font family |
| `--acm-z-index` | `1000` | Banner stacking context |

If you need deeper control, target the classes directly:

| Component | Root class | Notable child classes |
|---|---|---|
| `CookieBanner` | `.acm-banner` | `.acm-banner__title`, `.acm-banner__description`, `.acm-banner__error`, `.acm-banner__actions`, `.acm-banner__button`, `.acm-banner__button--primary`, `.acm-banner__button--secondary` |
| `CookieDialog` | `.acm-dialog` | `.acm-dialog__title`, `.acm-dialog__option`, `.acm-dialog__checkbox`, `.acm-dialog__actions`, `.acm-dialog__button`, `.acm-dialog__button--primary` |
| `ManageConsentTrigger` | `.acm-manage-trigger` | — |

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
