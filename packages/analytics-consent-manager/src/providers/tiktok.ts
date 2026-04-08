import type { ProviderAdapter } from '../core/types'

declare global {
  interface Window {
    ttq?: (...args: unknown[]) => void
  }
}

export function createTikTokConsentAdapter(): ProviderAdapter {
  return {
    id: 'tiktok',
    requiredConsent: 'marketing',
    onConsentChange(context) {
      if (typeof window === 'undefined' || typeof window.ttq !== 'function') return
      window.ttq('consent', context.consent?.marketing ? 'grant' : 'reject')
    },
  }
}
