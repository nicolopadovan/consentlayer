import {
  createConsentController,
  type ConsentController,
  type ConsentControllerOptions,
} from './core/consent-controller'
import type { Analytics } from './core/types'

/**
 * Starts a consent controller for an Astro site and sends a page view on
 * every page load, including the navigations of `<ClientRouter />`. Call it
 * once, from a `<script>` in a component every page renders.
 */
export function consentLayer(analytics: Analytics, options?: ConsentControllerOptions): ConsentController {
  const controller = createConsentController(analytics, options)
  controller.start()
  const setRoute = () => controller.setRoute(location.pathname + location.search)
  setRoute()
  document.addEventListener('astro:page-load', setRoute)
  return controller
}
