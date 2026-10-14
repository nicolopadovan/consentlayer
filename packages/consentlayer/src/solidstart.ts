import { useIsRouting, useLocation } from '@solidjs/router'
import { createComponent, mergeProps, type JSX } from 'solid-js'
import { AnalyticsProvider as SolidAnalyticsProvider, type AnalyticsProviderProps } from './solid'

export {
  ErrorBoundary,
  MetaPixelNoscript,
  useAnalytics,
  useConsent,
  useConsentController,
  type ConsentController,
  type ErrorBoundaryProps,
} from './solid'

/** Props for `<AnalyticsProvider>` from `consentlayer/solidstart`: the route comes from Solid Router. */
export type SolidStartAnalyticsProviderProps = Omit<AnalyticsProviderProps, 'routeKey'>

/**
 * `<AnalyticsProvider>` for SolidStart and Solid Router: sends a page view on
 * every navigation to a new path or query string. Render it in the router's
 * `root`.
 */
export function AnalyticsProvider(props: SolidStartAnalyticsProviderProps): JSX.Element {
  const location = useLocation()
  const isRouting = useIsRouting()
  return createComponent(
    SolidAnalyticsProvider,
    mergeProps(props, {
      // The router updates `location` before the browser URL, which it sets when routing ends.
      get routeKey() {
        return isRouting() ? null : location.pathname + location.search
      },
    }),
  )
}
