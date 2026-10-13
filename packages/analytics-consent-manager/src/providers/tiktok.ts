import { definePlugin } from '../core/plugin'

declare global {
  interface Window {
    ttq?: (...args: unknown[]) => void
  }
}

/** Forwards consent to a `ttq` the app loads itself. */
export function tiktok() {
  return definePlugin({
    id: 'tiktok',
    requiredConsent: 'marketing',
    consent({ consent }) {
      if (typeof window === 'undefined' || typeof window.ttq !== 'function') return
      window.ttq('consent', consent?.marketing ? 'grant' : 'reject')
    },
  })
}
