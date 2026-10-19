import { getContext, onMount } from 'svelte'
import type { Action } from 'svelte/action'
import { mountBanner, type BannerOptions } from '../banner'
import type { ConsentController } from '../core/consent-controller'
import { CoreControllerKey } from './context'

export type { BannerOptions } from '../banner'

function coreController() {
  const controller = getContext<ConsentController | undefined>(CoreControllerKey)
  if (!controller) throw new Error('consentBanner needs consentLayer() in a parent component')
  return controller
}

/** Renders the ready-made banner while the element is mounted, as in `<svelte:body use:consentBanner={options} />`. */
export const consentBanner: Action<HTMLElement, BannerOptions | undefined> = (_node, options) => {
  const controller = coreController()
  let unmount = mountBanner(controller, options)
  return {
    update(next) {
      unmount()
      unmount = mountBanner(controller, next)
    },
    destroy: () => unmount(),
  }
}

/** Renders the ready-made banner while the calling component is mounted. Call it in the component's `<script>`. */
export function useConsentBanner(options?: BannerOptions): void {
  const controller = coreController()
  onMount(() => mountBanner(controller, options))
}
