import { addComponent, addImports, addPlugin, addTemplate, createResolver, defineNuxtModule, findPath } from 'nuxt/kit'
import type { NuxtModule } from 'nuxt/schema'
import type { ConsentLayerOptions } from '../vue'

/** The `consentlayer` key of `nuxt.config`: the `consentLayer` plugin options that are not functions. */
export type ModuleOptions = Omit<ConsentLayerOptions, 'analytics' | 'router'>

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: { name: 'consentlayer', configKey: 'consentlayer', compatibility: { nuxt: '>=4.0.0' } },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const config = await findPath('~/consentlayer.config')
    if (!config) throw new Error('consentlayer/nuxt needs app/consentlayer.config.ts, exporting defineConsentLayerConfig(() => options)')

    addTemplate({ filename: 'consentlayer.config.mjs', getContents: () => `export { default } from ${JSON.stringify(config)}` })
    addTemplate({ filename: 'consentlayer.options.mjs', getContents: () => `export default ${JSON.stringify(options)}` })
    nuxt.options.build.transpile.push(resolver.resolve('.'))
    addPlugin(resolver.resolve('./plugin'))
    addImports([
      { name: 'defineConsentLayerConfig', from: resolver.resolve('./config') },
      ...['useAnalytics', 'useConsent', 'useConsentController'].map((name) => ({ name, from: 'consentlayer/vue' })),
    ])
    addComponent({ name: 'MetaPixelNoscript', export: 'MetaPixelNoscript', filePath: 'consentlayer/vue' })
  },
})

export default module
