import type { EventName } from '../core/types'
import { definePlugin, getFlag, loadScript, setFlag, skippedPlugin } from '../core/plugin'
import { expireCookies } from '../core/utils'

declare global {
  interface Window {
    _uxa?: unknown[][]
  }
}

/** Options for `contentsquare`. */
export type ContentsquareOptions = {
  /** The ID in your tag's URL: `t.contentsquare.net/uxa/<tagId>.js`. */
  /** `undefined` or `''` turns the provider off. */
  tagId: string | undefined
  /** Event names `track` sends to it: all by default, none with `false`. */
  events?: readonly EventName[] | false
}

const push = (...command: unknown[]) => (window._uxa = window._uxa ?? []).push(command)
const pathOf = (path = location.pathname) => path.split(/[?#]/)[0]
const maskQuery = (redact: (value: string) => string) => {
  const query = redact(location.search)
  if (query !== location.search) push('setQuery', query)
}

/** Contentsquare (Hotjar's successor), after analytics consent. */
export function contentsquare(options: ContentsquareOptions) {
  const tagId = options.tagId?.trim()
  if (!tagId) return skippedPlugin('contentsquare', 'tagId')
  let loadedPath: string | undefined
  return definePlugin({
    id: 'contentsquare',
    events: options.events,
    requiredConsent: 'analytics',
    consent(context) {
      // ponytail: Contentsquare has no web opt-in; dropping the opt-out cookie takes effect on the next page load
      if (typeof window !== 'undefined' && context.consent?.analytics) expireCookies((name) => name === '_cs_optout')
    },
    load({ redact }) {
      if (typeof window === 'undefined' || getFlag('ContentsquareInitialized')) return
      window._uxa = window._uxa ?? []
      loadedPath = pathOf()
      maskQuery(redact)
      if (redact(document.referrer) !== document.referrer) push('referrer:removeQueryString')
      void loadScript(`https://t.contentsquare.net/uxa/${tagId}.js`).catch(() => undefined)
      setFlag('ContentsquareInitialized', true)
    },
    page(page, { redact }) {
      const path = pathOf(page.path)
      if (path === loadedPath) {
        loadedPath = undefined
        return
      }
      loadedPath = undefined
      maskQuery(redact)
      push('trackPageview', path)
    },
    track(event) {
      if (event.name !== 'purchase') {
        push('trackPageEvent', event.name)
        return
      }
      const { transaction_id, value, currency } = event.params
      push('ec:transaction:create', { id: transaction_id, revenue: value, currency })
      push('ec:transaction:send')
    },
    identify(identity) {
      if (identity.userId) push('identify', identity.userId)
    },
    reset() {
      push('resetIdentity')
    },
    teardown(context) {
      if (typeof window === 'undefined' || context.consent?.analytics || !getFlag('ContentsquareInitialized')) return
      push('optout')
    },
  })
}
