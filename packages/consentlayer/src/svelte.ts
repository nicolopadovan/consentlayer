import { getContext, onMount, setContext, type Component } from 'svelte'
import { createSubscriber } from 'svelte/reactivity'
import {
  createConsentController,
  type ConsentControllerActions,
  type ConsentControllerOptions,
  type ConsentControllerState,
} from './core/consent-controller'
import { latestAnalytics } from './core/create-analytics'
import type { Analytics, ConsentApi, ConsentState, PageViewPayload } from './core/types'
import type { HTMLImgAttributes } from 'svelte/elements'
import MetaPixelNoscriptComponent from './svelte/MetaPixelNoscript.svelte'

/** The part of SvelteKit's `afterNavigate` ConsentLayer uses. */
export type AfterNavigateLike = (callback: (navigation: { to: { url: URL } | null }) => void) => void

/** Options for `consentLayer()`. */
export type ConsentLayerOptions = ConsentControllerOptions & {
  analytics: Analytics
  /** SvelteKit's `afterNavigate`; sends a page view on every navigation. Without it, one page view is sent for the page load. */
  afterNavigate?: AfterNavigateLike
  page?: PageViewPayload
}

/** What `useConsentController()` returns: the UI state as reactive properties, and the actions. */
export type ConsentController = Readonly<ConsentControllerState> & ConsentControllerActions

/**
 * Meta's `<noscript>` PageView pixel. It fires only for visitors without
 * JavaScript, who never see the consent banner, so it tracks them without
 * consent. Render it only where that is lawful for you. Renders nothing without
 * `enabled` or while `pixelId` is unset. Other attributes go to the `<img>`.
 */
export const MetaPixelNoscript: Component<{ pixelId: string | undefined; enabled?: boolean } & HTMLImgAttributes> =
  MetaPixelNoscriptComponent

const AnalyticsKey = Symbol('consentlayer.analytics')
const ControllerKey = Symbol('consentlayer.controller')

/** Boots analytics, sends page views on navigation and provides the state for your consent UI. Call it in your root component. */
export function consentLayer({ analytics, afterNavigate, page, ...options }: ConsentLayerOptions): ConsentController {
  const controller = createConsentController(analytics, options)
  const subscribe = createSubscriber((update) => controller.subscribe(update))
  const read = () => {
    subscribe()
    return controller.getSnapshot()
  }
  const ui: ConsentController = {
    get ready() {
      return read().ready
    },
    get error() {
      return read().error
    },
    get bannerVisible() {
      return read().bannerVisible
    },
    get dialogVisible() {
      return read().dialogVisible
    },
    get categories() {
      return read().categories
    },
    get gpc() {
      return read().gpc
    },
    get prefs() {
      return read().prefs
    },
    ...controller.actions,
  }
  setContext(AnalyticsKey, analytics)
  setContext(ControllerKey, ui)

  afterNavigate?.(({ to }) => {
    if (to) controller.setRoute(to.url.pathname + to.url.search, page)
  })
  onMount(() => {
    if (!afterNavigate) controller.setRoute('default', page)
    return controller.start()
  })
  return ui
}

/** The instance from `consentLayer()`, else the one `createAnalytics()` made. */
export function useAnalytics(): Analytics {
  const analytics = getContext<Analytics | undefined>(AnalyticsKey) ?? latestAnalytics()
  if (!analytics) throw new Error('useAnalytics needs createAnalytics() to have run, or consentLayer()')
  return analytics
}

/** Current consent as a reactive property, `null` before a choice. */
export function useConsent(): {
  readonly consent: ConsentState | null
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
} {
  const analytics = useAnalytics()
  const subscribe = createSubscriber((update) => analytics.consent.subscribe(update))
  return {
    get consent() {
      subscribe()
      return analytics.consent.getConsent()
    },
    engine: analytics.consent,
    setConsent: (next) => analytics.consent.setConsent(next),
    update: (partial) => analytics.consent.update(partial),
  }
}

/** State and actions for building your own consent UI. */
export function useConsentController(): ConsentController {
  const controller = getContext<ConsentController | undefined>(ControllerKey)
  if (!controller) throw new Error('useConsentController needs consentLayer() in a parent component')
  return controller
}
