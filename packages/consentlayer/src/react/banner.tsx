import { useContext, useEffect } from 'react'
import { mountBanner, type BannerOptions } from '../banner'
import { CoreControllerContext } from './analytics-provider'

/** Renders the ready-made banner and settings dialog for the consent state of `<AnalyticsProvider>`. */
export function ConsentBanner(options: BannerOptions) {
  const controller = useContext(CoreControllerContext)
  if (!controller) throw new Error('ConsentBanner must be used within AnalyticsProvider')
  const key = JSON.stringify(options)
  useEffect(() => mountBanner(controller, JSON.parse(key) as BannerOptions), [controller, key])
  return null
}
