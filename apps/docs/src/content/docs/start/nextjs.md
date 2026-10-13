---
title: Next.js
description: Set up consentlayer in a Next.js App Router app.
---

This guide sets up consentlayer in the App Router: an analytics instance, a
consent banner, page views on every navigation and error reporting. The
[example app](https://github.com/nicolopadovan/analytics-consent-manager-npm/tree/main/apps/example-next)
is a complete, working version of it.

## 1. Create the instance

Create the instance once, at module level, so any file can import it.
Add only the providers you have configured.

```ts
// lib/analytics.ts
import { createAnalytics, type AnalyticsPlugin } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
import { meta } from 'consentlayer/providers/meta'

const providers: AnalyticsPlugin[] = []
if (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) {
  providers.push(ga4({ measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID }))
}
if (process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID) {
  providers.push(meta({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID }))
}

export const analytics = createAnalytics({ providers, autoTracking: true })
```

Read each `NEXT_PUBLIC_*` variable by its full name, as above. Next.js inlines
only literal `process.env.NEXT_PUBLIC_X` reads into browser code.

## 2. Add the provider and the banner

Copy the [consent banner recipe](/guides/consent-ui/) into
`components/consent-banner.tsx`. Then create a client component that wraps
your app in `<AnalyticsProvider>`:

```tsx
// components/analytics-shell.tsx
'use client'

import { AnalyticsProvider } from 'consentlayer/react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'
import { ConsentBanner } from './consent-banner'

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <AnalyticsProvider analytics={analytics} routeKey={`${pathname}?${searchParams}`}>
      <ConsentBanner privacyPolicyUrl="/privacy" />
      {children}
    </AnalyticsProvider>
  )
}
```

`AnalyticsProvider` reads the stored consent, shows the banner when there is
none, boots the providers and sends a page view whenever `routeKey` changes.

## 3. Wrap the layout

`useSearchParams` needs a `<Suspense>` boundary above it, so wrap the shell in
one:

```tsx
// app/layout.tsx
import { Suspense, type ReactNode } from 'react'
import { AnalyticsShell } from '../components/analytics-shell'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <AnalyticsShell>{children}</AnalyticsShell>
        </Suspense>
      </body>
    </html>
  )
}
```

Using Meta Pixel? Render `<MetaPixelNoscript pixelId={…} />` from
`consentlayer/react` in the body too, for visitors without JavaScript. Using
Shopify Customer Privacy? Load its script here with `next/script` (see
[Providers](/guides/providers/)).

## 4. Track events

Use `useAnalytics()` in client components, or import the instance anywhere
else:

```tsx
'use client'

import { useAnalytics } from 'consentlayer/react'

export function SignUpButton() {
  const analytics = useAnalytics()
  return <button onClick={() => analytics.track('sign_up', { method: 'email' })}>Sign up</button>
}
```

[Events and identity](/guides/events/) lists the standard events and what each
provider receives.

## 5. Report errors

Wrap parts of the tree in `ErrorBoundary`. It reports the error with
`captureError` and renders `fallback`, which is a node or a function of
`{ error, reset }`:

```tsx
import { ErrorBoundary } from 'consentlayer/react'

<ErrorBoundary fallback={<p>Could not load the cart.</p>} tags={{ area: 'cart' }}>
  <Cart />
</ErrorBoundary>
```

`app/global-error.tsx` replaces the root layout when it crashes, so the
provider isn't there. `createGlobalError` boots the instance itself and
reports the error with Next.js's `digest`:

```tsx
// app/global-error.tsx
'use client'

import { createGlobalError } from 'consentlayer/react'
import { analytics } from '../lib/analytics'

export default createGlobalError(analytics)
```

To render your own page, pass a second argument,
`({ error, reset }) => ReactNode`; it is rendered inside `<html><body>`.

For server errors with Sentry, add `instrumentation.ts` and wrap the Next.js
config. Server errors are always sent, without personal data:

```ts
// instrumentation.ts
import { sentryInstrumentation } from 'consentlayer/sentry/server'

export const { register, onRequestError } = sentryInstrumentation({ dsn: process.env.SENTRY_DSN })
```

```ts
// next.config.ts
import { withSentryConfig } from 'consentlayer/sentry/next'

export default withSentryConfig(nextConfig, { silent: true })
```

`withSentryConfig` is `@sentry/nextjs`'s own. Give it `org`, `project` and
`authToken` to upload source maps.

## Options

### Boot timing

By default, providers boot as soon as `<AnalyticsProvider>` mounts. To keep them off
the critical path, boot when the browser is idle:

```tsx
<AnalyticsProvider analytics={analytics} boot={{ mode: 'idle', timeoutMs: 3000 }} routeKey={…}>
```

| `mode` | Providers boot |
|---|---|
| `'immediate'` (default) | on mount |
| `'idle'` | when the browser is idle, or after `timeoutMs` at the latest |
| `'manual'` | when you call `analytics.boot()` |

Events tracked before boot are held (up to 100) and delivered after it.

### Server-side tracking

To also send events to the Meta Conversions API from your server, add one
route and set `server.endpoint`. See
[Server-side tracking](/guides/server-side-tracking/).
