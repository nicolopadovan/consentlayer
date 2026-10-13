import { definePlugin, getFlag, loadScript, setFlag } from '../core/plugin'

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
  const hosts = location.hostname.split('.').map((_, i, parts) => parts.slice(i).join('.'))
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (!name?.startsWith('_hj')) continue
    for (const domain of ['', ...hosts.map((host) => `; domain=${host}`)]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
    }
  }
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

/** Hotjar, after analytics consent. */
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
