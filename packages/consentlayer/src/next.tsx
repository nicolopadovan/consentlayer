import { usePathname, useSearchParams } from 'next/navigation.js'
import { Suspense, useEffect, useState } from 'react'
import { AnalyticsProvider as BaseAnalyticsProvider, type AnalyticsProviderProps } from './react/analytics-provider'

/** Props for `<AnalyticsProvider>` from `consentlayer/next`: the route comes from the App Router. */
export type NextAnalyticsProviderProps = Omit<AnalyticsProviderProps, 'routeKey'>

function RouteKey({ onChange }: { onChange: (routeKey: string) => void }) {
  const routeKey = `${usePathname()}?${useSearchParams().toString()}`
  useEffect(() => onChange(routeKey), [onChange, routeKey])
  return null
}

/**
 * `<AnalyticsProvider>` for the Next.js App Router: sends a page view on every
 * navigation, query changes included. Only its route listener suspends, so
 * your pages still render on the server.
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
