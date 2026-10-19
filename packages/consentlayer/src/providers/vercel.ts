import type { EventName } from '../core/types'
import { definePlugin } from '../core/plugin'
import { sanitizeVercelPayload } from '../core/utils'

/** Options for `vercel`: pass `track` from `@vercel/analytics` as `trackEvent`. */
export type VercelOptions = {
  trackEvent: (name: string, payload: Record<string, string | number | boolean | null>) => void
  /** Event names `track` sends to it: all by default, none with `false`. */
  events?: readonly EventName[] | false
}

/** Vercel Analytics is cookieless, so it runs without consent. */
export function vercel(options: VercelOptions) {
  return definePlugin({
    id: 'vercel',
    events: options.events,
    requiredConsent: 'none',
    track(event) {
      options.trackEvent(event.name, sanitizeVercelPayload(event.params))
    },
  })
}
