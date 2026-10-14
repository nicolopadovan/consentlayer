import { useSyncExternalStore } from 'react'
import { createAnalytics, definePlugin, type ConsentState, type ProviderConsentRequirement } from 'consentlayer'
import { AnalyticsProvider, useAnalytics, useConsent, useConsentController } from 'consentlayer/react'
import { ConsentBanner } from './ConsentBanner'
import './playground.css'

declare module 'consentlayer' {
  interface ConsentCategories {
    functional: true
  }
}

type Entry = { id: number; time: string; provider: string; hook: string; detail: string }

let entries: Entry[] = []
const listeners = new Set<() => void>()
const log = (provider: string, hook: string, detail = '') => {
  entries = [{ id: entries.length, time: new Date().toLocaleTimeString(), provider, hook, detail }, ...entries]
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const consentLabel = (consent: ConsentState | null) =>
  consent ? analytics.consent.categories.map((key) => `${key} ${consent[key] ? '✓' : '✗'}`).join(', ') : 'no choice yet'

function logger(id: string, requiredConsent: ProviderConsentRequirement) {
  return definePlugin({
    id,
    requiredConsent,
    setup: () => log(id, 'setup'),
    load: () => log(id, 'load'),
    consent: (ctx) => log(id, 'consent', consentLabel(ctx.consent)),
    page: (page) => log(id, 'page', page.path ?? ''),
    track: (event) => log(id, 'track', `${event.name} ${JSON.stringify(event.params)}`),
    identify: (identity) => log(id, 'identify', JSON.stringify(identity)),
    teardown: () => log(id, 'teardown'),
  })
}

const analytics = createAnalytics({
  names: { prefix: 'playground' },
  categories: ['functional'],
  providers: [
    logger('cookieless', 'none'),
    logger('product-analytics', 'analytics'),
    logger('ads-pixel', 'marketing'),
    logger('support-chat', 'functional'),
  ],
})

function Controls() {
  const tracker = useAnalytics()
  const { consent } = useConsent()
  const { openDialog } = useConsentController()
  return (
    <div className="pg-controls">
      <p>
        <strong>Consent:</strong> {consentLabel(consent)}
      </p>
      <div className="pg-buttons">
        <button onClick={() => void tracker.track('sign_up', { method: 'email' })}>Track sign_up</button>
        <button onClick={() => void tracker.track('purchase', { transaction_id: 'o1', value: 30, currency: 'EUR' })}>
          Track purchase
        </button>
        <button onClick={() => void tracker.identify('user_1', { email: 'ada@example.com' })}>Identify</button>
        <button onClick={openDialog}>Cookie settings</button>
        <button
          onClick={() => {
            localStorage.removeItem('playground_consent')
            localStorage.removeItem('playground_user_identity')
            location.reload()
          }}
        >
          Forget my choice
        </button>
      </div>
    </div>
  )
}

function Log() {
  const rows = useSyncExternalStore(
    subscribe,
    () => entries,
    () => entries,
  )
  return (
    <ol className="pg-log" aria-live="polite">
      {rows.map((entry) => (
        <li key={entry.id}>
          <time>{entry.time}</time> <code>{entry.provider}</code> <strong>{entry.hook}</strong> {entry.detail}
        </li>
      ))}
    </ol>
  )
}

export default function Playground() {
  return (
    <AnalyticsProvider analytics={analytics}>
      <div className="not-content">
        <Controls />
        <Log />
        <ConsentBanner />
      </div>
    </AnalyticsProvider>
  )
}
