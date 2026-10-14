import { createEffect, onCleanup, useContext, type JSX } from 'solid-js'
import { mountBanner, type BannerOptions } from '../banner'
import { CoreControllerContext } from './context'

/** ConsentLayer's ready-made banner, settings dialog and badge, mounted in the browser. Renders nothing in place. */
export function ConsentBanner(props: BannerOptions): JSX.Element {
  const controller = useContext(CoreControllerContext)
  if (!controller) throw new Error('ConsentBanner must be used within AnalyticsProvider')
  createEffect(() => onCleanup(mountBanner(controller, { ...props })))
  return null
}
