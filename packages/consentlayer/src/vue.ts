import {
  computed,
  defineComponent,
  getCurrentScope,
  h,
  inject,
  onScopeDispose,
  shallowRef,
  type App,
  type InjectionKey,
  type Plugin,
  type Ref,
} from 'vue'
import {
  createConsentController,
  type ConsentControllerActions,
  type ConsentControllerOptions,
  type ConsentControllerState,
} from './core/consent-controller'
import { latestAnalytics } from './core/create-analytics'
import { gtmNoscriptIframe, metaNoscriptImg } from './core/noscript'
import type { Analytics, ConsentApi, ConsentState, PageViewPayload } from './core/types'

type RouteLike = { fullPath: string }

/** The part of a Vue Router instance ConsentLayer uses. */
export type RouterLike = {
  currentRoute: { value: RouteLike }
  isReady: () => Promise<void>
  afterEach: (guard: (to: RouteLike, from: RouteLike, failure?: unknown) => unknown) => () => void
}

/** Options for `app.use(consentLayer, options)`. */
export type ConsentLayerOptions = ConsentControllerOptions & {
  analytics: Analytics
  /** Sends a page view on every navigation. Without it, one page view is sent for the page load. */
  router?: RouterLike
  page?: PageViewPayload
  /** Sends errors from `app.config.errorHandler` through `captureError`. Defaults to `true`. */
  captureErrors?: boolean
}

/** What `useConsentController()` returns: the UI state as refs, and the actions. */
export type ConsentController = {
  readonly [Key in keyof ConsentControllerState]: Readonly<Ref<ConsentControllerState[Key]>>
} & ConsentControllerActions

const AnalyticsKey: InjectionKey<Analytics> = Symbol('consentlayer.analytics')
const ControllerKey: InjectionKey<ConsentController> = Symbol('consentlayer.controller')

const routeKey = (route: RouteLike) => route.fullPath.replace(/#.*$/, '')

/** Boots analytics, sends page views on navigation and provides the state for your consent UI. */
export const consentLayer: Plugin<[ConsentLayerOptions]> = {
  install(app: App, { analytics, router, page, captureErrors = true, ...options }: ConsentLayerOptions) {
    const controller = createConsentController(analytics, options)
    const state = shallowRef(controller.getSnapshot())
    const field = <Key extends keyof ConsentControllerState>(key: Key) => computed(() => state.value[key])
    app.provide(AnalyticsKey, analytics)
    app.provide(ControllerKey, {
      ready: field('ready'),
      error: field('error'),
      bannerVisible: field('bannerVisible'),
      dialogVisible: field('dialogVisible'),
      categories: field('categories'),
      gpc: field('gpc'),
      prefs: field('prefs'),
      ...controller.actions,
    })

    if (typeof window === 'undefined') return
    if (captureErrors) {
      const previous = app.config.errorHandler
      app.config.errorHandler = (error, instance, info) => {
        void analytics.captureError(error, { source: 'boundary', tags: { vue_info: info } })
        if (previous) previous(error, instance, info)
        else console.error(error)
      }
    }

    const unsubscribe = controller.subscribe(() => {
      state.value = controller.getSnapshot()
    })
    const stop = controller.start()
    let stopRouter = () => {}
    if (router) {
      stopRouter = router.afterEach((to, _from, failure) => {
        if (!failure) controller.setRoute(routeKey(to), page)
      })
      void router.isReady().then(() => controller.setRoute(routeKey(router.currentRoute.value), page))
    } else {
      controller.setRoute('default', page)
    }
    app.onUnmount(() => {
      stopRouter()
      stop()
      unsubscribe()
    })
  },
}

/** The instance from `app.use(consentLayer)`, else the one `createAnalytics()` made. */
export function useAnalytics(): Analytics {
  const analytics = inject(AnalyticsKey, undefined) ?? latestAnalytics()
  if (!analytics) throw new Error('useAnalytics needs createAnalytics() to have run, or app.use(consentLayer)')
  return analytics
}

/** Current consent as a ref, `null` before a choice. */
export function useConsent(): {
  consent: Readonly<Ref<ConsentState | null>>
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
} {
  const analytics = useAnalytics()
  const consent = shallowRef(analytics.consent.getConsent())
  const unsubscribe = analytics.consent.subscribe(() => {
    consent.value = analytics.consent.getConsent()
  })
  if (getCurrentScope()) onScopeDispose(unsubscribe)
  return {
    consent,
    engine: analytics.consent,
    setConsent: (next) => analytics.consent.setConsent(next),
    update: (partial) => analytics.consent.update(partial),
  }
}

/** State and actions for building your own consent UI. */
export function useConsentController(): ConsentController {
  const controller = inject(ControllerKey, undefined)
  if (!controller) throw new Error('useConsentController needs app.use(consentLayer)')
  return controller
}

/**
 * Meta's `<noscript>` PageView pixel. It fires only for visitors without
 * JavaScript, who never see the consent banner, so it tracks them without
 * consent. Render it only where that is lawful for you. Renders nothing without
 * `enabled` or while `pixelId` is unset. Other attributes go to the `<img>`.
 */
export const MetaPixelNoscript = defineComponent({
  name: 'MetaPixelNoscript',
  inheritAttrs: false,
  props: { pixelId: { type: String, default: undefined }, enabled: Boolean },
  setup(props, { attrs }) {
    return () =>
      props.enabled && props.pixelId ? h('noscript', { innerHTML: metaNoscriptImg(props.pixelId, attrs) }) : null
  },
})

/**
 * Google Tag Manager's `<noscript>` iframe. It loads the container only for
 * visitors without JavaScript, who never see the consent banner, so its tags
 * run without consent. Render it only where that is lawful for you. Renders
 * nothing without `enabled` or while `containerId` is unset. Other attributes go to the `<iframe>`.
 */
export const GtmNoscript = defineComponent({
  name: 'GtmNoscript',
  inheritAttrs: false,
  props: { containerId: { type: String, default: undefined }, enabled: Boolean },
  setup(props, { attrs }) {
    return () =>
      props.enabled && props.containerId
        ? h('noscript', { innerHTML: gtmNoscriptIframe(props.containerId, attrs) })
        : null
  },
})
