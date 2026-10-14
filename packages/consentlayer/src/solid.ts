import {
  createComponent,
  createContext,
  createEffect,
  createSignal,
  ErrorBoundary as SolidErrorBoundary,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
  type Accessor,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { Dynamic, isServer } from 'solid-js/web'
import {
  createConsentController,
  type ConsentControllerActions,
  type ConsentControllerOptions,
  type ConsentControllerState,
} from './core/consent-controller'
import { latestAnalytics } from './core/create-analytics'
import { metaNoscriptImg } from './core/meta-noscript'
import type { Analytics, ConsentApi, ConsentState, ErrorContext, PageViewPayload } from './core/types'

/** Props for `<AnalyticsProvider>`. */
export type AnalyticsProviderProps = ConsentControllerOptions & {
  analytics: Analytics
  children?: JSX.Element
  /** Changes on every navigation; a page view is sent once per key. `null` holds page views until the route is known. */
  routeKey?: string | null
  page?: PageViewPayload
}

/** What `useConsentController()` returns: the UI state as reactive properties, and the actions. */
export type ConsentController = Readonly<ConsentControllerState> & ConsentControllerActions

const AnalyticsContext = createContext<Analytics>()
const ControllerContext = createContext<ConsentController>()

/** Boots analytics, sends page views on navigation and provides the state for your consent UI. */
export function AnalyticsProvider(props: AnalyticsProviderProps): JSX.Element {
  const { analytics, boot, autoShowBanner, openConsentGlobalKey } = props
  const controller = createConsentController(analytics, { boot, autoShowBanner, openConsentGlobalKey })
  const [state, setState] = createSignal(controller.getSnapshot())
  const ui: ConsentController = {
    get ready() {
      return state().ready
    },
    get error() {
      return state().error
    },
    get bannerVisible() {
      return state().bannerVisible
    },
    get dialogVisible() {
      return state().dialogVisible
    },
    get categories() {
      return state().categories
    },
    get prefs() {
      return state().prefs
    },
    ...controller.actions,
  }

  onMount(() => {
    const unsubscribe = controller.subscribe(() => setState(controller.getSnapshot()))
    const stop = controller.start()
    onCleanup(() => {
      stop()
      unsubscribe()
    })
  })
  createEffect(() => controller.setRoute(props.routeKey === undefined ? 'default' : props.routeKey, props.page))

  return createComponent(AnalyticsContext.Provider, {
    value: analytics,
    get children() {
      return createComponent(ControllerContext.Provider, {
        value: ui,
        get children() {
          return props.children
        },
      })
    },
  })
}

/** The instance from `<AnalyticsProvider>`, else the one `createAnalytics()` made. */
export function useAnalytics(): Analytics {
  const analytics = useContext(AnalyticsContext) ?? latestAnalytics()
  if (!analytics) throw new Error('useAnalytics needs createAnalytics() to have run, or an AnalyticsProvider above it')
  return analytics
}

/** Current consent as an accessor, `null` before a choice. */
export function useConsent(): {
  consent: Accessor<ConsentState | null>
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
} {
  const analytics = useAnalytics()
  const [consent, setConsent] = createSignal(analytics.consent.getConsent())
  if (!isServer) onCleanup(analytics.consent.subscribe(() => setConsent(analytics.consent.getConsent())))
  return {
    consent,
    engine: analytics.consent,
    setConsent: (next) => analytics.consent.setConsent(next),
    update: (partial) => analytics.consent.update(partial),
  }
}

/** State and actions for building your own consent UI. */
export function useConsentController(): ConsentController {
  const controller = useContext(ControllerContext)
  if (!controller) throw new Error('useConsentController must be used within AnalyticsProvider')
  return controller
}

/** Props for `<ErrorBoundary>`. */
export type ErrorBoundaryProps = {
  children?: JSX.Element
  fallback: JSX.Element | ((error: unknown, reset: () => void) => JSX.Element)
  /** Defaults to the instance from `<AnalyticsProvider>`, else the one `createAnalytics()` made. */
  analytics?: Analytics
  tags?: ErrorContext['tags']
}

/** Renders `fallback` when a child throws, and sends the error through `captureError`. */
export function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  const context = useContext(AnalyticsContext)
  return createComponent(SolidErrorBoundary, {
    fallback: (error: unknown, reset: () => void) => {
      void (props.analytics ?? context ?? latestAnalytics())?.captureError(error, { source: 'boundary', tags: props.tags })
      return typeof props.fallback === 'function' ? props.fallback(error, reset) : props.fallback
    },
    get children() {
      return props.children
    },
  })
}

/**
 * Meta's `<noscript>` PageView pixel. It fires only for visitors without
 * JavaScript, who never see the consent banner, so it tracks them without
 * consent. Render it only where that is lawful for you. Renders nothing without
 * `enabled` or while `pixelId` is unset. Other attributes go to the `<img>`.
 */
export function MetaPixelNoscript(
  props: { pixelId: string | undefined; enabled?: boolean } & ComponentProps<'img'>,
): JSX.Element {
  const [own, attrs] = splitProps(props, ['pixelId', 'enabled'])
  return Show({
    get when() {
      return own.enabled && own.pixelId
    },
    get children() {
      return createComponent(Dynamic, {
        component: 'noscript',
        get innerHTML() {
          return metaNoscriptImg(own.pixelId ?? '', attrs)
        },
      })
    },
  })
}
