'use client'

import {
  createAnalyticsManager,
  createConsentEngine,
  createLocalStorageConsentStorage,
  createLocalStorageIdentityStorage,
  defaultRuntimePreset,
  setDefaultConsentEngine,
  setDefaultIdentityStorage,
  setDefaultRuntimeAnalyticsManager,
} from '@your-scope/analytics-consent-manager'
import {
  AnalyticsManager,
  AutoTracking,
  ConsentControllerProvider,
  ConsentProvider,
} from '@your-scope/analytics-consent-manager/react'
import {
  CookieBanner,
  CookieDialog,
  ManageConsentTrigger,
} from '@your-scope/analytics-consent-manager/ui'
import { createGa4Adapter } from '@your-scope/analytics-consent-manager/providers/ga4'
import { createHotjarAdapter } from '@your-scope/analytics-consent-manager/providers/hotjar'
import {
  createMetaAdapter,
} from '@your-scope/analytics-consent-manager/providers/meta'
import {
  createShopifyAnalyticsAdapter,
  createShopifyCustomerPrivacyAdapter,
} from '@your-scope/analytics-consent-manager/providers/shopify'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

type AnalyticsShellEnv = {
  runtimeEnabled: boolean
  debug: boolean
  ga4: {
    measurementId?: string
  }
  hotjar: {
    siteId?: number
    version?: number
  }
  meta: {
    pixelId?: string
    noscriptEnabled: boolean
  }
  shopify: {
    storeId?: string
    storefrontDomain?: string
    storefrontAccessToken?: string
  }
  server: {
    metaToken?: string
    facebookTestEventCode?: string
    ga4ApiSecret?: string
  }
}

type AnalyticsShellRuntime = {
  consentEngine: ReturnType<typeof createConsentEngine>
  manager: ReturnType<typeof createAnalyticsManager>
}

export type AnalyticsShellProps = {
  children: ReactNode
  env: AnalyticsShellEnv
}

function createAnalyticsShellRuntime(
  env: AnalyticsShellEnv,
): AnalyticsShellRuntime {
  const consentEngine = createConsentEngine({
    storage: createLocalStorageConsentStorage({
      key: defaultRuntimePreset.consentStorageKey,
    }),
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
    broadcast: {
      eventName: defaultRuntimePreset.consentEventName,
      globalKey: defaultRuntimePreset.consentGlobalKey,
    },
    debug: env.debug,
  })

  const identityStorage = createLocalStorageIdentityStorage({
    key: defaultRuntimePreset.identityStorageKey,
  })

  const manager = createAnalyticsManager({
    consentEngine,
    identityStorage,
    enabled: env.runtimeEnabled,
    debug: env.debug,
    defaultEventDestinations: ['ga4', 'meta', 'shopify', 'hotjar'],
  })

  if (env.ga4.measurementId) {
    manager.registerProvider(
      createGa4Adapter({ measurementId: env.ga4.measurementId }),
    )
  }
  if (env.meta.pixelId) {
    manager.registerProvider(
      createMetaAdapter({
        pixelId: env.meta.pixelId,
        serverEndpoint: '/api/facebook/track',
      }),
    )
  }
  if (env.shopify.storeId) {
    manager.registerProvider(createShopifyAnalyticsAdapter())
  }
  if (env.hotjar.siteId && env.hotjar.version) {
    manager.registerProvider(
      createHotjarAdapter({
        siteId: env.hotjar.siteId,
        version: env.hotjar.version,
      }),
    )
  }

  setDefaultConsentEngine(consentEngine)
  setDefaultIdentityStorage(identityStorage)
  setDefaultRuntimeAnalyticsManager(manager)

  return {
    consentEngine,
    manager,
  }
}

export function AnalyticsShell({ children, env }: AnalyticsShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const [runtime] = useState(() => createAnalyticsShellRuntime(env))
  const [lazyBoot] = useState(() => ({
    mode: 'idle' as const,
    timeoutMs: 3000,
  }))

  useEffect(
    () => () => {
      runtime.manager.destroy()
      runtime.consentEngine.destroy()
    },
    [runtime],
  )

  return (
    <ConsentProvider engine={runtime.consentEngine}>
      <ConsentControllerProvider>
        <AnalyticsManager
          lazy={lazyBoot}
          manager={runtime.manager}
          routeKey={routeKey}
        />
        <AutoTracking manager={runtime.manager} routeKey={routeKey} />
        <CookieBanner className="banner" />
        <CookieDialog className="dialog" />
        <ManageConsentTrigger className="button manage" />
        {children}
      </ConsentControllerProvider>
    </ConsentProvider>
  )
}
