import type { ProviderAdapter } from '../core/types'
import { sanitizeVercelPayload } from '../core/utils'

export type VercelAdapterOptions = {
  trackEvent: (
    name: string,
    payload: Record<string, string | number | boolean | null>,
  ) => void
}

export function createVercelAdapter(
  options: VercelAdapterOptions,
): ProviderAdapter {
  return {
    id: 'vercel',
    requiredConsent: 'analytics',
    trackEvent(event) {
      options.trackEvent(event.name, sanitizeVercelPayload(event.params))
    },
  }
}
