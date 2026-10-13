# Next.js Integration

The example app in [`apps/example-next`](../apps/example-next) is the reference implementation.

## Main Files

- analytics instance: [`apps/example-next/lib/analytics.ts`](../apps/example-next/lib/analytics.ts)
- consumer shell: [`apps/example-next/components/analytics-shell.tsx`](../apps/example-next/components/analytics-shell.tsx)
- layout wiring: [`apps/example-next/app/layout.tsx`](../apps/example-next/app/layout.tsx)
- tracking from components: [`apps/example-next/components/demo-client.tsx`](../apps/example-next/components/demo-client.tsx)
- global error page: [`apps/example-next/app/global-error.tsx`](../apps/example-next/app/global-error.tsx)
- Sentry server setup: [`apps/example-next/instrumentation.ts`](../apps/example-next/instrumentation.ts)
- server route: [`apps/example-next/app/api/analytics/route.ts`](../apps/example-next/app/api/analytics/route.ts)

## Integration Shape

1. Create one instance at module level with `createAnalytics({ providers })`, passing only the providers that are configured. Read each `NEXT_PUBLIC_*` variable literally (`process.env.NEXT_PUBLIC_X`): Next inlines only those into browser code.
2. In a client shell, Wrap the app with `<AnalyticsProvider analytics={analytics} routeKey={…}>`.
3. Render the UI components (or your own UI built on `useConsent()` / `useConsentController()`).
4. Track from components with `useAnalytics()`. See [events and identity](./events.md).
5. Add `app/global-error.tsx` and, for Sentry, `instrumentation.ts` (see "Errors").
6. Optionally forward events to Meta CAPI: one route with `createAnalyticsHandler` and `server: { endpoint }`. See [server-side tracking](./server-side-tracking.md).

## Minimal Wiring

```ts
// lib/analytics.ts
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'

export const analytics = createAnalytics({
  providers: [ga4({ measurementId: 'G-XXXXXXX' })],
  autoTracking: true,
})
```

```tsx
'use client'

import { AnalyticsProvider } from 'consentlayer/react'
import { CookieBanner, CookieDialog, ManageConsentTrigger } from 'consentlayer/ui'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <AnalyticsProvider
      analytics={analytics}
      boot={{ mode: 'idle', timeoutMs: 3000 }}
      routeKey={`${pathname}?${searchParams.toString()}`}
    >
      <CookieBanner />
      <CookieDialog />
      <ManageConsentTrigger />
      {children}
    </AnalyticsProvider>
  )
}
```

`AnalyticsProvider` reads stored consent, shows the banner when there is none,
boots the providers, sends a page view per `routeKey` and starts a new
auto-tracking page session on navigation.

## Layout Concerns

- load the Shopify consent tracking script if you use Shopify Customer Privacy
- render optional Meta noscript markup in the layout
- keep page content inside `AnalyticsProvider` so the UI and runtime share the same state

## Lazy Boot

`boot` accepts `{ mode: 'immediate' | 'idle' | 'manual', timeoutMs? }`
(default `immediate`). With `manual`, call `analytics.boot()` yourself.

The example app uses `idle`. That means provider initialization can lag a couple of seconds behind first paint.

## Errors

Wrap parts of the tree in `ErrorBoundary`; it reports to `captureError` and
renders `fallback` (a node, or a function of `{ error, reset }`):

```tsx
import { ErrorBoundary } from 'consentlayer/react'

<ErrorBoundary fallback={<p>Could not load the cart.</p>} tags={{ area: 'cart' }}>
  <Cart />
</ErrorBoundary>
```

`app/global-error.tsx` replaces the root layout when it crashes, so it boots
the instance itself and reports the error with Next's `digest`:

```tsx
'use client'

import { createGlobalError } from 'consentlayer/react'
import { analytics } from '../lib/analytics'

export default createGlobalError(analytics)
```

Pass a second argument, `({ error, reset }) => ReactNode`, to render your own
page inside `<html><body>`.

For server errors with Sentry, add `instrumentation.ts` and wrap the config.
Server errors are always sent, without personal data:

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

`withSentryConfig` is re-exported from `@sentry/nextjs`; give it `org`, `project` and
`authToken` to upload source maps.
