import { definePlugin } from '../core/plugin'
import { sanitizeVercelPayload } from '../core/utils'

/** Options for `vercel`: pass `track` from `@vercel/analytics` as `trackEvent`. */
export type VercelOptions = {
  trackEvent: (
    name: string,
    payload: Record<string, string | number | boolean | null>,
  ) => void
}

/** Vercel Analytics is cookieless, so it runs without consent. */
export function vercel(options: VercelOptions) {
  return definePlugin({
    id: 'vercel',
    requiredConsent: 'none',
    track(event) {
      options.trackEvent(event.name, sanitizeVercelPayload(event.params))
    },
  })
}
