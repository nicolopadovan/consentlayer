# Next.js Integration

The example app in [`apps/example-next`](../apps/example-next) is the reference implementation.

## Main Files

- consumer shell: [`apps/example-next/components/analytics-shell.tsx`](../apps/example-next/components/analytics-shell.tsx)
- layout wiring: [`apps/example-next/app/layout.tsx`](../apps/example-next/app/layout.tsx)
- tracking from components: [`apps/example-next/components/demo-client.tsx`](../apps/example-next/components/demo-client.tsx)
- Meta route example: [`apps/example-next/app/api/facebook/track/route.ts`](../apps/example-next/app/api/facebook/track/route.ts)
- GA4 route example: [`apps/example-next/app/api/ga4/track/route.ts`](../apps/example-next/app/api/ga4/track/route.ts)

## Integration Shape

1. Read environment config on the server with `createEnvConfig(process.env)`.
2. In a client shell, create one instance with `createAnalytics({ providers })`, passing only the providers that are configured.
3. Wrap the app with `<AnalyticsProvider analytics={analytics} routeKey={…}>`.
4. Render the UI components (or your own UI built on `useConsent()` / `useConsentController()`).
5. Track from components with `useAnalytics()`. See [events and identity](./events.md).
6. Keep server tracking routes app-local and build them from the exported server helpers.

## Minimal Wiring

```tsx
'use client'

import { createAnalytics } from '@nicolopadovan/analytics-consent-manager'
import { AnalyticsProvider } from '@nicolopadovan/analytics-consent-manager/react'
import { CookieBanner, CookieDialog, ManageConsentTrigger } from '@nicolopadovan/analytics-consent-manager/ui'
import { createGa4Adapter } from '@nicolopadovan/analytics-consent-manager/providers/ga4'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [analytics] = useState(() =>
    createAnalytics({
      providers: [createGa4Adapter({ measurementId: 'G-XXXXXXX' })],
      autoTracking: true,
    }),
  )

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
