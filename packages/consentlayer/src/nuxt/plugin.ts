import config from '#build/consentlayer.config.mjs'
import options from '#build/consentlayer.options.mjs'
import { createAnalytics } from 'consentlayer'
import { consentLayer } from 'consentlayer/vue'
import { defineNuxtPlugin, useRouter } from 'nuxt/app'

export default defineNuxtPlugin({
  name: 'consentlayer',
  setup(nuxtApp) {
    const { captureErrors = true, ...rest } = options
    const analytics = createAnalytics(config())
    nuxtApp.vueApp.use(consentLayer, { ...rest, captureErrors: false, analytics, router: useRouter() })
    if (captureErrors && import.meta.client) {
      nuxtApp.hook('vue:error', (error, _instance, info) => {
        void analytics.captureError(error, { source: 'boundary', tags: { vue_info: info } })
      })
    }
  },
})
