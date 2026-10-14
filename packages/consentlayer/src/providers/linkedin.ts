import { definePlugin, getFlag, loadScript, setFlag, skippedPlugin } from '../core/plugin'
import type { EventName, LoadTiming } from '../core/types'
import { expireCookies } from '../core/utils'

declare global {
  interface Window {
    lintrk?: ((command: string, data?: Record<string, unknown>) => void) & { q?: unknown[] }
    _linkedin_partner_id?: string
    _linkedin_data_partner_ids?: string[]
  }
}

/** Options for `linkedin`. */
export type LinkedInOptions = {
  /** The Insight Tag partner ID, as a number or a string of digits; `undefined` or `''` turns the provider off. */
  partnerId: number | string | undefined
  /** Conversion IDs keyed by the event name passed to `track()`. Other events are not sent. */
  events?: Partial<Record<EventName, number>>
  defer?: LoadTiming
}

// LinkedIn's cookie table, "Cookies LinkedIn drops on third party sites": https://www.linkedin.com/legal/l/cookie-table
const FIRST_PARTY_COOKIES = ['li_fat_id', 'li_giant', 'oribi_cookie_test', 'oribili_user_guid', 'ln_or', 'ar_debug']

/** LinkedIn Insight Tag, after marketing consent. */
export function linkedin(options: LinkedInOptions) {
  const partnerId = String(options.partnerId ?? '').trim()
  if (!partnerId) return skippedPlugin('linkedin', 'partnerId')
  if (!/^\d+$/.test(partnerId)) {
    throw new Error(`[consentlayer] Invalid LinkedIn partner ID: expected digits, received "${partnerId}".`)
  }
  const conversionIds: Partial<Record<string, number>> = options.events ?? {}
  return definePlugin({
    id: 'linkedin',
    requiredConsent: 'marketing',
    defer: options.defer,
    events: options.events ? Object.keys(options.events) : false,
    load({ emitError }) {
      if (typeof window === 'undefined' || getFlag('LinkedInInitialized')) return
      window._linkedin_partner_id = partnerId
      window._linkedin_data_partner_ids = window._linkedin_data_partner_ids ?? []
      window._linkedin_data_partner_ids.push(partnerId)
      if (!window.lintrk) {
        const lintrk = (command: string, data?: Record<string, unknown>) => lintrk.q.push([command, data])
        lintrk.q = [] as unknown[]
        window.lintrk = lintrk
      }
      loadScript('https://snap.licdn.com/li.lms-analytics/insight.min.js').catch(() =>
        emitError({ scope: 'provider-script-load', message: 'Failed to load the LinkedIn Insight Tag' }),
      )
      setFlag('LinkedInInitialized', true)
    },
    track(event) {
      const conversionId = conversionIds[event.name]
      if (conversionId !== undefined) window.lintrk?.('track', { conversion_id: conversionId, event_id: event.id })
    },
    teardown(context) {
      if (typeof window === 'undefined' || context.consent?.marketing) return
      expireCookies((name) => FIRST_PARTY_COOKIES.includes(name))
    },
  })
}
