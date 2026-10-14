import { createAnalytics, type AnalyticsOptions } from '../core/create-analytics'
import { createConsentController, type ConsentControllerOptions } from '../core/consent-controller'
import type { AnalyticsPlugin } from '../core/types'
import { contentsquare } from '../providers/contentsquare'
import { ga4 } from '../providers/ga4'
import { hotjar } from '../providers/hotjar'
import { meta } from '../providers/meta'
import { posthog } from '../providers/posthog'
import { sentry } from '../providers/sentry'
import { createShopifyCustomerPrivacyAdapter } from '../providers/shopify'
import { tiktok } from '../providers/tiktok'
import { vercel } from '../providers/vercel'
import type { BannerConfig } from './banner'
import { setPostHogHost } from './cdn/posthog-host'

declare global {
  interface Window {
    ConsentLayer?: (GlobalConfig | ConsentLayerGlobal) & { banner?: BannerConfig }
    va?: (event: 'event', payload: { name: string; data: Record<string, unknown> }) => void
  }
}

/** `window.ConsentLayer` before the script loads: `createAnalytics()` options, with `providers` keyed by provider name. */
export type GlobalConfig = Omit<AnalyticsOptions, 'providers'> &
  ConsentControllerOptions & { providers?: Record<string, Record<string, unknown>> }

const factories: Record<string, (options: never) => AnalyticsPlugin> = {
  ga4,
  meta,
  tiktok,
  contentsquare,
  hotjar,
  posthog,
  sentry,
  vercel: (options: object) => vercel({ trackEvent: (name, data) => window.va?.('event', { name, data }), ...options }),
}

const attributes: Record<string, [provider: string, option?: string, flag?: boolean]> = {
  ga4: ['ga4', 'measurementId'],
  metaPixel: ['meta', 'pixelId'],
  tiktokPixel: ['tiktok', 'pixelId'],
  contentsquareTag: ['contentsquare', 'tagId'],
  hotjarSite: ['hotjar', 'siteId'],
  hotjarVersion: ['hotjar', 'version'],
  posthogKey: ['posthog', 'apiKey'],
  posthogHost: ['posthog', 'apiHost'],
  posthogRecording: ['posthog', 'recording', true],
  sentryDsn: ['sentry', 'dsn'],
  sentryEnvironment: ['sentry', 'environment'],
  sentryReplay: ['sentry', 'replay', true],
  sentryTracing: ['sentry', 'tracing', true],
  shopify: ['shopify'],
  vercel: ['vercel'],
}

const flag = (value: string) => value !== 'false'

/** Merges `window.ConsentLayer` with the script tag's `data-` attributes; an attribute wins over the same option in the object. */
export function readConfig(global: GlobalConfig | undefined, script: HTMLOrSVGScriptElement | null): GlobalConfig {
  const config: GlobalConfig = { ...global }
  const providers: Record<string, Record<string, unknown>> = {}
  for (const [name, options] of Object.entries(global?.providers ?? {})) providers[name] = { ...options }
  const dataset = script instanceof HTMLScriptElement ? script.dataset : {}
  for (const [key, value] of Object.entries(dataset)) {
    if (value === undefined) continue
    if (key === 'autoTracking') config.autoTracking = flag(value)
    else if (key === 'debug') config.debug = flag(value)
    else if (attributes[key]) {
      const [provider, option, isFlag] = attributes[key]
      providers[provider] ??= {}
      if (option) providers[provider][option] = isFlag ? flag(value) : value
    }
  }
  config.providers = providers
  return config
}

/** Creates the instance and its consent controller from a `GlobalConfig`, starts them and sends a page view per URL. */
export function createGlobal(config: GlobalConfig) {
  const { providers = {}, boot, autoShowBanner, openConsentGlobalKey, ...options } = config
  const plugins: AnalyticsPlugin[] = []
  const adapters = [...(options.consent?.adapters ?? [])]
  for (const [name, providerOptions] of Object.entries(providers)) {
    if (name === 'shopify') adapters.push(createShopifyCustomerPrivacyAdapter(providerOptions))
    else if (factories[name]) plugins.push(factories[name](providerOptions as never))
    else console.warn(`[consentlayer] Unknown provider "${name}".`)
  }
  setPostHogHost(providers.posthog?.apiHost as string | undefined)
  const analytics = createAnalytics({ ...options, providers: plugins, consent: { ...options.consent, adapters } })
  const controller = createConsentController(analytics, { boot, autoShowBanner, openConsentGlobalKey })
  controller.start()
  const route = () => controller.setRoute(location.pathname + location.search)
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method]
    history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
      original.apply(this, args)
      route()
    }
  }
  addEventListener('popstate', route)
  route()
  return { ...analytics, controller }
}

export type ConsentLayerGlobal = ReturnType<typeof createGlobal>
