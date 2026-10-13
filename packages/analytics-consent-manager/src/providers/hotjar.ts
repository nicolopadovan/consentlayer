import { getFlag, setFlag } from '../core/names'
import type { ProviderAdapter } from '../core/types'

declare global {
  interface Window {
    hj?: (...args: unknown[]) => void
    _hjSettings?: { hjid: number; hjsv: number }
  }
}

export type HotjarAdapterOptions = {
  siteId: number
  version: number
}

function ensureHotjar(options: HotjarAdapterOptions): void {
  if (typeof window === 'undefined' || getFlag('HotjarInitialized')) return
  window.hj =
    window.hj ??
    ((...args: unknown[]) => {
      ;(window.hj as unknown as { q?: unknown[] }).q =
        (window.hj as unknown as { q?: unknown[] }).q ?? []
      ;(window.hj as unknown as { q: unknown[] }).q.push(args)
    })
  window._hjSettings = { hjid: options.siteId, hjsv: options.version }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://static.hotjar.com/c/hotjar-${options.siteId}.js?sv=${options.version}`
  script.dataset.hotjar = String(options.siteId)
  document.head.appendChild(script)
  setFlag('HotjarInitialized', true)
}

export function createHotjarAdapter(
  options: HotjarAdapterOptions,
): ProviderAdapter {
  return {
    id: 'hotjar',
    requiredConsent: 'analytics',
    init() {
      ensureHotjar(options)
    },
    trackEvent(event) {
      window.hj?.('event', event.name)
    },
    identify(identity, traits) {
      const attributes = Object.fromEntries(
        Object.entries(traits).filter(([key]) => key !== 'email' && key !== 'phone'),
      )
      window.hj?.('identify', identity.userId ?? null, attributes)
    },
  }
}
