import { afterNavigate } from '$app/navigation'
import type { Analytics } from './core/types'
import { consentLayer as svelteConsentLayer, type ConsentController, type ConsentLayerOptions } from './svelte'

export {
  GtmNoscript,
  MetaPixelNoscript,
  useAnalytics,
  useConsent,
  useConsentController,
  type ConsentController,
} from './svelte'

/** Options for `consentLayer()` from `consentlayer/sveltekit`. */
export type SvelteKitConsentLayerOptions = Omit<ConsentLayerOptions, 'afterNavigate'>

/** Boots analytics, sends a page view on every SvelteKit navigation and provides the state for your consent UI. Call it in your root layout. */
export function consentLayer(options: SvelteKitConsentLayerOptions): ConsentController {
  return svelteConsentLayer({ ...options, afterNavigate })
}

/** A client `handleError` hook that sends the errors your code throws (`kind: 'unknown'`) through `captureError`. */
export function handleErrorWith(analytics: Analytics): (input: { kind: string; error: unknown }) => void {
  return ({ kind, error }) => {
    if (kind === 'unknown') void analytics.captureError(error, { source: 'boundary' })
  }
}
