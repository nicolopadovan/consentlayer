import { useRouter } from 'next/compat/router.js'
import { usePathname, useSearchParams } from 'next/navigation.js'
import { Suspense, useEffect, useState } from 'react'
import { AnalyticsProvider as BaseAnalyticsProvider, type AnalyticsProviderProps } from './react/analytics-provider'

/** Props for `<AnalyticsProvider>` from `consentlayer/next`: the route comes from the Next.js router. */
export type NextAnalyticsProviderProps = Omit<AnalyticsProviderProps, 'routeKey'>

function RouteKey({ onChange }: { onChange: (routeKey: string) => void }) {
  const pagesRouter = useRouter()
  const pathname: string | null = usePathname()
  const searchParams: URLSearchParams | null = useSearchParams()
  const routeKey = pathname === null || pagesRouter?.isReady === false ? null : `${pathname}?${searchParams?.toString() ?? ''}`
  useEffect(() => {
    if (routeKey !== null) onChange(routeKey)
  }, [onChange, routeKey])
  return null
}

/**
 * `<AnalyticsProvider>` for the Next.js App Router and Pages Router: sends a
 * page view on every navigation, query changes included. Only its route
 * listener suspends, so your pages still render on the server.
 */
export function AnalyticsProvider({ children, ...props }: NextAnalyticsProviderProps) {
  const [routeKey, setRouteKey] = useState<string | null>(null)
  return (
    <BaseAnalyticsProvider {...props} routeKey={routeKey}>
      <Suspense fallback={null}>
        <RouteKey onChange={setRouteKey} />
      </Suspense>
      {children}
    </BaseAnalyticsProvider>
  )
}
