import { definePlugin, getFlag, loadScript, setFlag, skippedPlugin } from '../core/plugin'
import type { ConsentState, EventName, LoadTiming } from '../core/types'

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] }
  }
}

/** Options for `clarity`. */
export type ClarityOptions = {
  /** The project ID in your tracking code: `clarity.ms/tag/<projectId>`. `undefined` or `''` turns the provider off. */
  projectId: string | undefined
  /** Event names sent to Clarity as custom events; all by default, `false` for none. */
  events?: readonly EventName[] | false
  /** Sends the user ID from `identify()` as Clarity's custom ID. Defaults to `true`. */
  identify?: boolean
  defer?: LoadTiming
}

const PROJECT_ID = /^[a-z0-9]+$/i

const consentSignals = (consent: ConsentState | null) => ({
  ad_Storage: consent?.marketing ? 'granted' : 'denied',
  analytics_Storage: consent?.analytics ? 'granted' : 'denied',
})

/** Microsoft Clarity, after analytics consent. Its consent API follows analytics and marketing. */
export function clarity(options: ClarityOptions) {
  const projectId = options.projectId?.trim()
  if (!projectId) return skippedPlugin('clarity', 'projectId')
  if (!PROJECT_ID.test(projectId)) {
    throw new Error(`[consentlayer] Invalid Clarity project ID: expected letters and digits, received "${projectId}".`)
  }
  let sent: string | undefined
  const sendConsent = (consent: ConsentState | null) => {
    const signals = JSON.stringify(consentSignals(consent))
    if (!window.clarity || !consent?.analytics || signals === sent) return
    sent = signals
    window.clarity('consentv2', consentSignals(consent))
  }
  return definePlugin({
    id: 'clarity',
    requiredConsent: 'analytics',
    defer: options.defer,
    events: options.events,
    load({ consent, emitError }) {
      if (typeof window === 'undefined' || getFlag('ClarityInitialized')) return
      window.clarity =
        window.clarity ??
        function clarity() {
          // eslint-disable-next-line prefer-rest-params
          ;(window.clarity!.q = window.clarity!.q ?? []).push(arguments)
        }
      sendConsent(consent)
      loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`).catch(() =>
        emitError({ scope: 'provider-script-load', message: `Failed to load Microsoft Clarity project ${projectId}` }),
      )
      setFlag('ClarityInitialized', true)
    },
    consent({ consent }) {
      if (typeof window !== 'undefined') sendConsent(consent)
    },
    track(event) {
      window.clarity?.('event', event.name)
    },
    identify(identity) {
      if (options.identify !== false && identity.userId) window.clarity?.('identify', identity.userId)
    },
    teardown(context) {
      if (typeof window === 'undefined' || context.consent?.analytics || !window.clarity) return
      sent = undefined
      window.clarity('consent', false)
    },
  })
}
