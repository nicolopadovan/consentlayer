'use client'

import {
  createAnalytics,
  type createEnvConfig,
  type ProviderAdapter,
} from '@nicolopadovan/analytics-consent-manager'
import { AnalyticsProvider } from '@nicolopadovan/analytics-consent-manager/react'
import {
  CookieBanner,
  CookieDialog,
  ManageConsentTrigger,
} from '@nicolopadovan/analytics-consent-manager/ui'
import { createGa4Adapter } from '@nicolopadovan/analytics-consent-manager/providers/ga4'
import { createHotjarAdapter } from '@nicolopadovan/analytics-consent-manager/providers/hotjar'
import { createMetaAdapter } from '@nicolopadovan/analytics-consent-manager/providers/meta'
import {
  createShopifyAnalyticsAdapter,
  createShopifyCustomerPrivacyAdapter,
} from '@nicolopadovan/analytics-consent-manager/providers/shopify'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

type AnalyticsShellEnv = ReturnType<typeof createEnvConfig>

export type AnalyticsShellProps = {
  children: ReactNode
  env: AnalyticsShellEnv
}

function createShellAnalytics(env: AnalyticsShellEnv) {
  const providers: ProviderAdapter[] = []
  if (env.ga4.measurementId) {
    providers.push(createGa4Adapter({ measurementId: env.ga4.measurementId }))
  }
  if (env.meta.pixelId) {
    providers.push(
      createMetaAdapter({
        pixelId: env.meta.pixelId,
        serverEndpoint: '/api/facebook/track',
      }),
    )
  }
  if (env.shopify.storeId) {
    providers.push(createShopifyAnalyticsAdapter())
  }
  if (env.hotjar.siteId && env.hotjar.version) {
    providers.push(
      createHotjarAdapter({
        siteId: env.hotjar.siteId,
        version: env.hotjar.version,
      }),
    )
  }

  return createAnalytics({
    providers,
    consent: {
      adapters: [
        createShopifyCustomerPrivacyAdapter({
          loadFeature: true,
          ...(env.shopify.storefrontAccessToken
            ? {
                headlessStorefront: {
                  storefrontAccessToken: env.shopify.storefrontAccessToken,
                },
              }
            : {}),
        }),
      ],
    },
    autoTracking: true,
    enabled: env.runtimeEnabled,
    debug: env.debug,
  })
}

const idleBoot = { mode: 'idle', timeoutMs: 3000 } as const

export function AnalyticsShell({ children, env }: AnalyticsShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [analytics] = useState(() => createShellAnalytics(env))

  useEffect(() => () => analytics.destroy(), [analytics])

  return (
    <AnalyticsProvider
      analytics={analytics}
      boot={idleBoot}
      routeKey={`${pathname}?${searchParams.toString()}`}
    >
      <CookieBanner className="banner" />
      <CookieDialog className="dialog" />
      <ManageConsentTrigger className="button manage" />
      {children}
    </AnalyticsProvider>
  )
}
