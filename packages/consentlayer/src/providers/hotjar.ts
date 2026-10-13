import { definePlugin, getFlag, loadScript, setFlag, skippedPlugin } from '../core/plugin'
import { expireCookies } from '../core/utils'

declare global {
  interface Window {
    hj?: (...args: unknown[]) => void
    _hjSettings?: { hjid: number; hjsv: number }
  }
}

/** Options for `hotjar`. */
export type HotjarOptions = {
  /** A number or numeric string; `undefined` or `''` turns the provider off. */
  siteId: number | string | undefined
  /** A number or numeric string; `undefined` or `''` turns the provider off. */
  version: number | string | undefined
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

function ensureHotjar(options: { siteId: number; version: number }): void {
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
  if (options.siteId === undefined || options.siteId === '') return skippedPlugin('hotjar', 'siteId')
  if (options.version === undefined || options.version === '') return skippedPlugin('hotjar', 'version')
  const siteId = Number(options.siteId)
  const version = Number(options.version)
  if (!Number.isSafeInteger(siteId) || siteId <= 0 || !Number.isSafeInteger(version) || version <= 0) {
    throw new Error(
      `[consentlayer] Invalid Hotjar siteId or version: expected positive integers, received ${JSON.stringify(options.siteId)} and ${JSON.stringify(options.version)}.`,
    )
  }
  return definePlugin({
    id: 'hotjar',
    requiredConsent: 'analytics',
    load() {
      ensureHotjar({ siteId, version })
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
