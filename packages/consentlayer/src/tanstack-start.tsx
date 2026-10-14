import { useRouterState } from '@tanstack/react-router'
import { AnalyticsProvider as BaseAnalyticsProvider, type AnalyticsProviderProps } from './react/analytics-provider'

/** Props for `<AnalyticsProvider>` from `consentlayer/tanstack-start`: the route comes from TanStack Router. */
export type TanStackStartAnalyticsProviderProps = Omit<AnalyticsProviderProps, 'routeKey'>

/**
 * `<AnalyticsProvider>` for TanStack Start and TanStack Router: sends a page
 * view once each navigation to a new path or query string has loaded. Render
 * it in the root route.
 */
export function AnalyticsProvider(props: TanStackStartAnalyticsProviderProps) {
  const routeKey = useRouterState({
    select: ({ resolvedLocation }) => (resolvedLocation ? resolvedLocation.pathname + resolvedLocation.searchStr : null),
  })
  return <BaseAnalyticsProvider {...props} routeKey={routeKey} />
}
