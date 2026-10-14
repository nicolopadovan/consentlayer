import { getNames } from './core/names'
import type { AutoTracking, AutoTrackingConfig } from './core/types'

export type {
  AutoTracking,
  AutoTrackingClickConfig,
  AutoTrackingClickMode,
  AutoTrackingConfig,
  AutoTrackingScrollConfig,
  AutoTrackingTimeConfig,
} from './core/types'

const DEFAULT_CLICK_SELECTORS = ['button', '[role="button"]', 'a', 'input[type="submit"]', 'input[type="button"]']
const DEFAULT_SCROLL_THRESHOLDS = [25, 50, 75, 100]
const DEFAULT_TIME_INTERVALS = [5, 15, 30, 60, 120]

/**
 * Tracks page sessions, clicks, scroll depth and time on page once analytics
 * consent is granted: `createAnalytics({ autoTracking: autoTracking() })`.
 * An object turns on only the kinds it names, unless it names none.
 */
export function autoTracking(config: AutoTrackingConfig = {}): AutoTracking {
  const { clicks, scroll, timeOnPage, pageViews, only } = config
  const named = [clicks, scroll, timeOnPage, pageViews].some((kind) => kind != null && kind !== false)
  const on = (kind: unknown) => (kind == null ? !named : kind !== false)
  const settings = <T extends object>(kind: boolean | T | undefined): Partial<T> =>
    typeof kind === 'object' ? kind : {}

  return ({ track, signal }) => {
    const send = (name: string, params: Record<string, unknown>) =>
      void track(name, params, { only, requireAnalyticsConsent: true })
    let session = 0
    let page = new AbortController()
    signal.addEventListener('abort', () => page.abort())

    if (on(clicks)) {
      const { mode = 'all', attribute = 'data-track', selectors = DEFAULT_CLICK_SELECTORS } = settings(clicks)
      const selector = mode === 'attribute' ? `[${attribute}]` : selectors.join(', ')
      const onClick = (event: Event) => {
        const element = selector ? (event.target as Element | null)?.closest(selector) : null
        if (!(element instanceof HTMLElement)) return
        send(getNames().autoTrackingEvents.uiClick, {
          ui_target: element.getAttribute(attribute) || element.getAttribute('aria-label') || 'unknown',
          ui_element: element.tagName.toLowerCase(),
          ui_id: element.id || undefined,
          path: window.location.pathname,
          session_id: session,
        })
      }
      window.addEventListener('click', onClick, { signal })
    }

    return () => {
      page.abort()
      page = new AbortController()
      const pageSignal = page.signal
      const sessionId = ++session

      if (on(pageViews)) send(getNames().autoTrackingEvents.pageSessionStart, { session_id: sessionId })

      if (on(scroll)) {
        const thresholds = (settings(scroll).thresholds ?? DEFAULT_SCROLL_THRESHOLDS)
          .filter((value) => Number.isFinite(value) && value > 0 && value <= 100)
          .sort((a, b) => a - b)
        const emitted = new Set<number>()
        const onScroll = () => {
          const doc = document.documentElement
          const total = doc.scrollHeight - window.innerHeight
          if (total <= 0) return
          const depth = Math.round(Math.min(1, (window.scrollY || doc.scrollTop) / total) * 100)
          for (const threshold of thresholds) {
            // Scroll positions rarely land exactly on the bottom, so 100 fires from 95.
            if (depth < (threshold === 100 ? 95 : threshold) || emitted.has(threshold)) continue
            emitted.add(threshold)
            send(getNames().autoTrackingEvents.scrollDepth, { depth: threshold, session_id: sessionId })
          }
          if (emitted.size === thresholds.length) window.removeEventListener('scroll', onScroll)
        }
        window.addEventListener('scroll', onScroll, { passive: true, signal: pageSignal })
      }

      if (on(timeOnPage)) {
        for (const seconds of settings(timeOnPage).intervals ?? DEFAULT_TIME_INTERVALS) {
          if (!Number.isFinite(seconds) || seconds <= 0) continue
          const handle = window.setTimeout(
            () => send(getNames().autoTrackingEvents.timeOnPage, { seconds, session_id: sessionId }),
            seconds * 1000,
          )
          pageSignal.addEventListener('abort', () => window.clearTimeout(handle))
        }
      }
    }
  }
}
