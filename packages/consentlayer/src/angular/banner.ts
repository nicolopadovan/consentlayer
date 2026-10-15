import {
  CSP_NONCE,
  DestroyRef,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  provideEnvironmentInitializer,
  untracked,
  type EnvironmentProviders,
} from '@angular/core'
import { injectConsentController } from 'consentlayer/angular'
import { mountBanner, type BannerOptions } from 'consentlayer/banner'

/**
 * Shows the ready-made consent banner and settings dialog in the browser, driven by
 * `provideConsentLayer()`'s controller. Removes them when the application is destroyed.
 */
export function provideConsentBanner(options: BannerOptions = {}): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    if (inject(PLATFORM_ID) !== 'browser') return
    const controller = injectConsentController()
    const injector = inject(Injector)
    const getSnapshot = () => ({
      ready: controller.ready(),
      error: controller.error(),
      bannerVisible: controller.bannerVisible(),
      dialogVisible: controller.dialogVisible(),
      categories: controller.categories(),
      gpc: controller.gpc(),
      chosen: controller.chosen(),
      prefs: controller.prefs(),
    })
    const unmount = mountBanner(
      {
        actions: controller,
        getSnapshot,
        subscribe: (listener) => {
          const watcher = effect(
            () => {
              getSnapshot()
              untracked(listener)
            },
            { injector },
          )
          return () => watcher.destroy()
        },
      },
      { ...options, nonce: options.nonce ?? inject(CSP_NONCE, { optional: true }) ?? undefined },
    )
    inject(DestroyRef).onDestroy(unmount)
  })
}
