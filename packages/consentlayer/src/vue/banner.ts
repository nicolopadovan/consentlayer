import { defineComponent, inject, onBeforeUnmount, onMounted, watch, type PropType } from 'vue'
import { mountBanner, type BannerOptions } from '../banner'
import { CoreControllerKey } from './core-controller-key'

const option = <Key extends keyof BannerOptions>(type: PropType<unknown>) => ({
  type: type as PropType<BannerOptions[Key]>,
  default: undefined,
})

/** ConsentLayer's ready-made banner, mounted with `mountBanner` on the controller from `app.use(consentLayer)`. Renders nothing in place. */
export const ConsentBanner = defineComponent({
  name: 'ConsentBanner',
  props: {
    position: option<'position'>(String),
    overlay: option<'overlay'>(Boolean),
    blocking: option<'blocking'>(Boolean),
    emphasis: option<'emphasis'>(String),
    closeButton: option<'closeButton'>(Boolean),
    badge: option<'badge'>([Boolean, Object]),
    privacyPolicyUrl: option<'privacyPolicyUrl'>(String),
    cookiePolicyUrl: option<'cookiePolicyUrl'>(String),
    termsUrl: option<'termsUrl'>(String),
    text: option<'text'>(Object),
    classNames: option<'classNames'>(Object),
    unstyled: option<'unstyled'>(Boolean),
    nonce: option<'nonce'>(String),
  },
  setup(props) {
    const controller = inject(CoreControllerKey, undefined)
    if (!controller) throw new Error('ConsentBanner needs app.use(consentLayer)')
    let unmount = () => {}
    const mount = () => {
      unmount()
      unmount = mountBanner(controller, { ...props })
    }
    onMounted(mount)
    watch(() => JSON.stringify(props), mount)
    onBeforeUnmount(() => unmount())
    return () => null
  },
})
