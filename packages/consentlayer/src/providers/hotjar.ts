import { definePlugin, getFlag, loadScript, setFlag } from '../core/plugin'
import { expireCookies } from '../core/utils'

declare global {
  interface Window {
    hj?: (...args: unknown[]) => void
    _hjSettings?: { hjid: number; hjsv: number }
  }
}

/** Options for `hotjar`. */
export type HotjarOptions = {
  siteId: number
  version: number
  /**
   * Hotjar can't be stopped once loaded. On analytics withdrawal its cookies
   * and storage are always deleted; `true` also reloads the page so recording stops.
   */
  reloadOnRevoke?: boolean
}

function clearHotjarStorage(): void {
  expireCookies((name) => name.startsWith('_hj'))
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (/^_?hj/.test(key)) storage.removeItem(key)
    }
  }
}

function ensureHotjar(options: HotjarOptions): void {
  if (typeof window === 'undefined' || getFlag('HotjarInitialized')) return
  window.hj =
    window.hj ??
    ((...args: unknown[]) => {
      ;(window.hj as unknown as { q?: unknown[] }).q =
        (window.hj as unknown as { q?: unknown[] }).q ?? []
      ;(window.hj as unknown as { q: unknown[] }).q.push(args)
    })
  window._hjSettings = { hjid: options.siteId, hjsv: options.version }

  void loadScript(
    `https://static.hotjar.com/c/hotjar-${options.siteId}.js?sv=${options.version}`,
  ).catch(() => undefined)
  setFlag('HotjarInitialized', true)
}

/**
 * Hotjar, after analytics consent.
 * @deprecated Hotjar accounts are moving to Contentsquare; use `contentsquare()` once yours has.
 */
export function hotjar(options: HotjarOptions) {
  return definePlugin({
    id: 'hotjar',
    requiredConsent: 'analytics',
    load() {
      ensureHotjar(options)
    },
    track(event) {
      window.hj?.('event', event.name)
    },
    identify(identity, traits) {
      const attributes = identity.userId && identity.email ? { ...traits, email: identity.email } : traits
      window.hj?.('identify', identity.userId ?? null, attributes)
    },
    teardown(context) {
      if (typeof window === 'undefined' || context.consent?.analytics) return
      try {
        clearHotjarStorage()
      } finally {
        if (options.reloadOnRevoke) location.reload()
      }
    },
    reset() {
      window.hj?.('identify', null, {})
    },
  })
}
