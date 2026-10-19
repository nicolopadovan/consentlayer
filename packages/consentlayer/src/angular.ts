import {
  ApplicationRef,
  computed,
  DestroyRef,
  DOCUMENT,
  ErrorHandler,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  PLATFORM_ID,
  provideEnvironmentInitializer,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core'
import { NavigationEnd, Router, ROUTES } from '@angular/router'
import {
  createConsentController,
  type ConsentControllerActions,
  type ConsentControllerOptions,
  type ConsentControllerState,
} from './core/consent-controller'
import { latestAnalytics } from './core/create-analytics'
import { gtmNoscriptIframe, metaNoscriptImg } from './core/noscript'
import type { Analytics, ConsentApi, ConsentState, PageViewPayload } from './core/types'

/** Options for `provideConsentLayer()`. */
export type ConsentLayerOptions = ConsentControllerOptions & {
  analytics: Analytics
  page?: PageViewPayload
  /** Reports errors that reach Angular's `ErrorHandler` through `captureError`. Defaults to `true`. */
  captureErrors?: boolean
}

/** What `injectConsentController()` returns: the UI state as signals, and the actions. */
export type ConsentController = {
  readonly [Key in keyof ConsentControllerState]: Signal<ConsentControllerState[Key]>
} & ConsentControllerActions

const ANALYTICS = new InjectionToken<Analytics>('consentlayer analytics')
const CONTROLLER = new InjectionToken<ConsentController>('consentlayer controller')

const isBrowser = () => inject(PLATFORM_ID) === 'browser'

/**
 * Provides the instance and the consent UI state. In the browser, boots
 * analytics once the application is stable, sends a page view per Angular
 * Router navigation, and reports errors from Angular's `ErrorHandler`.
 */
export function provideConsentLayer(options: ConsentLayerOptions): EnvironmentProviders {
  const { analytics, page, captureErrors = true, ...controllerOptions } = options
  return makeEnvironmentProviders([
    { provide: ANALYTICS, useValue: analytics },
    {
      provide: CONTROLLER,
      useFactory: (): ConsentController => {
        const controller = createConsentController(analytics, controllerOptions)
        const state = signal(controller.getSnapshot())
        if (isBrowser()) {
          const routes = inject(ROUTES, { optional: true })
          const router = routes && inject(Router)
          const navigations = router?.events.subscribe((event) => {
            // The router sets the page title right after NavigationEnd.
            if (event instanceof NavigationEnd)
              queueMicrotask(() => controller.setRoute(event.urlAfterRedirects.split('#')[0] ?? '/', page))
          })
          if (!router) controller.setRoute('default', page)
          const unsubscribe = controller.subscribe(() => state.set(controller.getSnapshot()))
          let stop: (() => void) | undefined
          let destroyed = false
          void inject(ApplicationRef)
            .whenStable()
            .then(() => {
              if (!destroyed) stop = controller.start()
            })
          inject(DestroyRef).onDestroy(() => {
            destroyed = true
            stop?.()
            unsubscribe()
            navigations?.unsubscribe()
          })
        }
        const field = <Key extends keyof ConsentControllerState>(key: Key) => computed(() => state()[key])
        return {
          ready: field('ready'),
          error: field('error'),
          bannerVisible: field('bannerVisible'),
          dialogVisible: field('dialogVisible'),
          categories: field('categories'),
          gpc: field('gpc'),
          chosen: field('chosen'),
          prefs: field('prefs'),
          laws: field('laws'),
          ...controller.actions,
        }
      },
    },
    provideEnvironmentInitializer(() => void inject(CONTROLLER)),
    captureErrors
      ? {
          provide: ErrorHandler,
          useFactory: (): ErrorHandler => {
            const fallback = new ErrorHandler()
            const browser = isBrowser()
            return {
              handleError(error: unknown) {
                if (browser) void analytics.captureError(error, { source: 'boundary' })
                fallback.handleError(error)
              },
            }
          },
        }
      : [],
  ])
}

/** The instance from `provideConsentLayer()`, else the one `createAnalytics()` made. */
export function injectAnalytics(): Analytics {
  const analytics = inject(ANALYTICS, { optional: true }) ?? latestAnalytics()
  if (!analytics) throw new Error('injectAnalytics needs createAnalytics() to have run, or provideConsentLayer()')
  return analytics
}

/** Current consent as a signal, `null` before a choice. */
export function injectConsent(): {
  consent: Signal<ConsentState | null>
  engine: ConsentApi
  setConsent: (consent: ConsentState) => Promise<void>
  update: (partial: Partial<ConsentState>) => Promise<void>
} {
  const analytics = injectAnalytics()
  const consent = signal(analytics.consent.getConsent())
  if (isBrowser()) {
    inject(DestroyRef).onDestroy(analytics.consent.subscribe(() => consent.set(analytics.consent.getConsent())))
  }
  return {
    consent: consent.asReadonly(),
    engine: analytics.consent,
    setConsent: (next) => analytics.consent.setConsent(next),
    update: (partial) => analytics.consent.update(partial),
  }
}

/** State and actions for building your own consent UI. */
export function injectConsentController(): ConsentController {
  const controller = inject(CONTROLLER, { optional: true })
  if (!controller) throw new Error('injectConsentController needs provideConsentLayer()')
  return controller
}

/**
 * Adds Meta's `<noscript>` PageView pixel to the end of `<body>` in HTML
 * rendered on the server. It fires only for visitors without JavaScript, who
 * never see the consent banner, so it tracks them without consent. Add it only
 * where that is lawful for you. Adds nothing without `enabled` or while
 * `pixelId` is unset. Other options become attributes of the `<img>`.
 */
export function provideMetaPixelNoscript({
  pixelId,
  enabled,
  ...attrs
}: { pixelId: string | undefined; enabled?: boolean } & Record<string, unknown>): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    if (!enabled || !pixelId || isBrowser()) return
    const document = inject(DOCUMENT)
    const noscript = document.createElement('noscript')
    noscript.innerHTML = metaNoscriptImg(pixelId, attrs)
    document.body.appendChild(noscript)
  })
}

/**
 * Adds Google Tag Manager's `<noscript>` iframe to the start of `<body>` in
 * HTML rendered on the server. It loads the container only for visitors without
 * JavaScript, who never see the consent banner, so its tags run without
 * consent. Add it only where that is lawful for you. Adds nothing without
 * `enabled` or while `containerId` is unset. Other options become attributes of the `<iframe>`.
 */
export function provideGtmNoscript({
  containerId,
  enabled,
  ...attrs
}: { containerId: string | undefined; enabled?: boolean } & Record<string, unknown>): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    if (!enabled || !containerId || isBrowser()) return
    const document = inject(DOCUMENT)
    const noscript = document.createElement('noscript')
    noscript.innerHTML = gtmNoscriptIframe(containerId, attrs)
    document.body.insertBefore(noscript, document.body.firstChild)
  })
}
