import { definePlugin, getFlag, loadScript, setFlag } from '../core/plugin'
import { expireCookies } from '../core/utils'

declare global {
  interface Window {
    _uxa?: unknown[][]
  }
}

/** Options for `contentsquare`. */
export type ContentsquareOptions = {
  /** The ID in your tag's URL: `t.contentsquare.net/uxa/<tagId>.js`. */
  tagId: string
}

const push = (...command: unknown[]) => (window._uxa = window._uxa ?? []).push(command)
const pathOf = (path = location.pathname) => path.split(/[?#]/)[0]

/** Contentsquare (Hotjar's successor), after analytics consent. */
export function contentsquare(options: ContentsquareOptions) {
  let loadedPath: string | undefined
  return definePlugin({
    id: 'contentsquare',
    requiredConsent: 'analytics',
    consent(context) {
      // ponytail: Contentsquare has no web opt-in; dropping the opt-out cookie takes effect on the next page load
      if (typeof window !== 'undefined' && context.consent?.analytics) expireCookies((name) => name === '_cs_optout')
    },
    load() {
      if (typeof window === 'undefined' || getFlag('ContentsquareInitialized')) return
      window._uxa = window._uxa ?? []
      loadedPath = pathOf()
      void loadScript(`https://t.contentsquare.net/uxa/${options.tagId}.js`).catch(() => undefined)
      setFlag('ContentsquareInitialized', true)
    },
    page(page) {
      const path = pathOf(page.path)
      if (path === loadedPath) {
        loadedPath = undefined
        return
      }
      loadedPath = undefined
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
