import { withLegacy } from './names'
import type { Analytics, ConsentCategory, ConsentState, LazyBootConfig, PageViewPayload } from './types'

type Prefs = Record<ConsentCategory, boolean>

/** The state your consent UI renders. */
export type ConsentControllerState = {
  ready: boolean
  error: string | null
  bannerVisible: boolean
  dialogVisible: boolean
  /** The categories the dialog shows, from `analytics.consent.categories`. */
  categories: readonly ConsentCategory[]
  /** Whether the browser's Global Privacy Control signal is honored: `acceptAll` then leaves marketing off. */
  gpc: boolean
  /** The dialog's toggles, one per category in `analytics.consent.categories`. */
  prefs: Prefs
}

/** Actions for your consent UI. */
export type ConsentControllerActions = {
  setPrefs: (next: Prefs) => void
  showBanner: () => void
  hideBanner: () => void
  openDialog: () => void
  closeDialog: () => void
  acceptAll: () => Promise<void>
  rejectNonEssential: () => Promise<void>
  savePreferences: () => Promise<void>
}

export type ConsentControllerOptions = {
  /** When providers load. Defaults to `{ mode: 'immediate' }`. */
  boot?: LazyBootConfig
  autoShowBanner?: boolean
  /** Defaults to the configured name (plus `ACM_openConsent` with `names.legacy`). */
  openConsentGlobalKey?: string
}

export type ConsentController = {
  actions: ConsentControllerActions
  getSnapshot: () => ConsentControllerState
  subscribe: (listener: () => void) => () => void
  /** Bootstraps consent, schedules boot and starts sending page views. Returns a function that stops it. */
  start: () => () => void
  /** Changes on every navigation; a page view is sent once per key. `null` holds page views until the route is known. */
  setRoute: (routeKey: string | null, page?: PageViewPayload) => void
}

function scheduleBoot(analytics: Analytics, boot: LazyBootConfig | undefined): () => void {
  const mode = boot?.mode ?? 'immediate'
  if (mode === 'manual') return () => undefined
  if (mode === 'immediate' || typeof window === 'undefined') {
    void analytics.boot()
    return () => undefined
  }
  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(() => void analytics.boot(), { timeout: boot?.timeoutMs ?? 3000 })
    return () => window.cancelIdleCallback?.(handle)
  }
  const timeout = globalThis.setTimeout(() => void analytics.boot(), boot?.timeoutMs ?? 1500)
  return () => globalThis.clearTimeout(timeout)
}

/** Boots `analytics`, sends a page view per route and holds the state of a consent banner and settings dialog. */
export function createConsentController(
  analytics: Analytics,
  { boot, autoShowBanner = true, openConsentGlobalKey }: ConsentControllerOptions = {},
): ConsentController {
  const engine = analytics.consent
  const all = (granted: boolean | ((category: ConsentCategory) => boolean)) =>
    Object.fromEntries(
      engine.categories.map((category) => [category, typeof granted === 'function' ? granted(category) : granted]),
    ) as Prefs
  let state: ConsentControllerState = {
    ready: false,
    error: null,
    bannerVisible: false,
    dialogVisible: false,
    categories: engine.categories,
    gpc: engine.gpc,
    prefs: all(false),
  }
  const listeners = new Set<() => void>()
  const set = (partial: Partial<ConsentControllerState>) => {
    state = { ...state, ...partial }
    listeners.forEach((listener) => listener())
  }

  let routeKey: string | null = null
  let sessionRouteKey: string | null | undefined
  let page: PageViewPayload | undefined
  let paged = { routeKey: null as string | null, providers: new Set<string>(), forwarded: new Set<ConsentCategory>() }
  const sendPageViews = () => {
    const snapshot = analytics.getSnapshot()
    if (!snapshot.booted || routeKey === null) return
    if (paged.routeKey !== routeKey) paged = { routeKey, providers: new Set(), forwarded: new Set() }
    const fresh = snapshot.activeProviders.filter((id) => !paged.providers.has(id))
    const granted = (['analytics', 'marketing'] as const).filter(
      (category) => snapshot.consent?.[category] && !paged.forwarded.has(category),
    )
    if (!fresh.length && !granted.length) return
    fresh.forEach((id) => paged.providers.add(id))
    const server = granted.length > 0 && (paged.forwarded.size ? granted : true)
    granted.forEach((category) => paged.forwarded.add(category))
    void analytics.page(page, { only: fresh, server })
  }

  const applyAndClose = async (consent: ConsentState) => {
    await engine.setConsent(consent)
    set({ bannerVisible: false, dialogVisible: false })
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      let stopped = false
      void engine
        .bootstrap()
        .then((consent) => {
          if (stopped) return
          set({
            ...(consent && { prefs: all((category) => consent[category]) }),
            bannerVisible: autoShowBanner && engine.shouldAsk(),
          })
        })
        .catch((error) => {
          if (!stopped) set({ error: String(error), bannerVisible: autoShowBanner })
        })
        .finally(() => {
          if (!stopped) set({ ready: true })
        })
      const cancelBoot = scheduleBoot(analytics, boot)
      const syncPrefs = (consent: ConsentState | null) => {
        if (consent) set({ prefs: all((category) => consent[category]) })
      }
      syncPrefs(engine.getConsent())
      const unsubscribeConsent = engine.subscribe(({ consent }) => syncPrefs(consent))
      const unsubscribeAnalytics = analytics.subscribe(sendPageViews)
      sendPageViews()
      const globals = typeof window === 'undefined' ? {} : (window as unknown as Record<string, unknown>)
      const openConsent = () => set({ dialogVisible: true })
      const keys = openConsentGlobalKey ? [openConsentGlobalKey] : withLegacy((names) => names.openConsentGlobalKey)
      for (const key of keys) globals[key] = openConsent
      return () => {
        stopped = true
        for (const key of keys) if (globals[key] === openConsent) delete globals[key]
        cancelBoot()
        unsubscribeConsent()
        unsubscribeAnalytics()
      }
    },
    setRoute(nextRouteKey, nextPage) {
      routeKey = nextRouteKey
      page = nextPage
      sendPageViews()
      if (nextRouteKey === null || sessionRouteKey === nextRouteKey) return
      const known = sessionRouteKey !== undefined && sessionRouteKey !== null
      sessionRouteKey = nextRouteKey
      if (known) analytics.newPageSession()
    },
    actions: {
      setPrefs: (prefs) => set({ prefs }),
      showBanner: () => set({ bannerVisible: true }),
      hideBanner: () => set({ bannerVisible: false }),
      openDialog: () => set({ dialogVisible: true }),
      closeDialog: () => set({ dialogVisible: false }),
      acceptAll: () => applyAndClose(all((category) => !(engine.gpc && category === 'marketing'))),
      rejectNonEssential: () => applyAndClose(all(false)),
      savePreferences: () => applyAndClose(all((category) => state.prefs[category])),
    },
  }
}
