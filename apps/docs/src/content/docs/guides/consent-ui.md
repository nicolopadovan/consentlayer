---
title: Consent UI
description: The banner, dialog and trigger components, their theme, language and copy, and building your own UI.
---

`consentlayer/ui` ships three components. They read and change consent through
`<AnalyticsProvider>`, so they work anywhere inside it:

- `CookieBanner` shows until the visitor chooses, with Accept all, Reject
  non-essential and Customize.
- `CookieDialog` has one toggle per category (necessary is always on).
- `ManageConsentTrigger` reopens the dialog, e.g. from the footer. So does
  `window.CONSENTLAYER_openConsent()`, for links outside React.

"Reject non-essential" denies preferences, analytics and marketing.

```tsx
import { CookieBanner, CookieDialog, ManageConsentTrigger } from 'consentlayer/ui'
import 'consentlayer/ui/styles.css'

<AnalyticsProvider analytics={analytics} privacyPolicyUrl="/privacy">
  {children}
  <CookieBanner />
  <CookieDialog />
  <ManageConsentTrigger />
</AnalyticsProvider>
```

## Theming

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

The stylesheet also matches the pre-rc.2 `.acm-*` classes and reads `--acm-*`
variables; the components emit `.acm-*` classes only with
[`names: { legacy: true }`](/guides/names/). Change the emitted prefix with
`names: { classPrefix }`.

## Language

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

## Your own UI

`useConsentController()` from `consentlayer/react` is what the built-in
components use. It returns the visibility state (`bannerVisible`,
`dialogVisible`), the dialog's draft `prefs` and `setPrefs`, and the actions
`acceptAll`, `rejectNonEssential`, `savePreferences`, `openDialog` and
`closeDialog`. `ready` turns true once stored consent has been read, so render
nothing before it to avoid a banner flash for returning visitors.
