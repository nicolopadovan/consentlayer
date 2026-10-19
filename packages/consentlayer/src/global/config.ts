import { googleConsentMode } from '../adapters/google-consent-mode'
import { shopifyCustomerPrivacy } from '../adapters/shopify'
import { tcf } from '../adapters/tcf'
import { autoTracking } from '../auto-tracking'
import { createAnalytics, type AnalyticsOptions } from '../core/create-analytics'
import { createConsentController, type ConsentControllerOptions } from '../core/consent-controller'
import type { AnalyticsPlugin, AutoTrackingConfig, ConsentIntegrationAdapter } from '../core/types'
import { clarity } from '../providers/clarity'
import { contentsquare } from '../providers/contentsquare'
import { ga4 } from '../providers/ga4'
import { googleAds } from '../providers/google-ads'
import { gtm } from '../providers/gtm'
import { hotjar } from '../providers/hotjar'
import { linkedin } from '../providers/linkedin'
import { meta } from '../providers/meta'
import { posthog } from '../providers/posthog'
import { sentry } from '../providers/sentry'
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

/** `window.ConsentLayer` before the script loads: `createAnalytics()` options, with `providers` and `adapters` keyed by name. */
export type GlobalConfig = Omit<AnalyticsOptions, 'providers' | 'autoTracking'> &
  ConsentControllerOptions & {
    /** `true` or the options of `autoTracking()`. */
    autoTracking?: boolean | AutoTrackingConfig
    providers?: Record<string, Record<string, unknown>>
    adapters?: Record<string, Record<string, unknown>>
  }

const factories: Record<string, (options: never) => AnalyticsPlugin> = {
  ga4,
  gtm,
  meta,
  tiktok,
  googleAds,
  linkedin,
  clarity,
  contentsquare,
  hotjar,
  posthog,
  sentry,
  vercel: (options: object) => vercel({ trackEvent: (name, data) => window.va?.('event', { name, data }), ...options }),
}

const adapterFactories: Record<string, (options: never) => ConsentIntegrationAdapter> = {
  googleConsentMode,
  shopify: shopifyCustomerPrivacy,
  tcf,
}

const attributes: Record<string, [provider: string, option?: string, flag?: boolean]> = {
  ga4: ['ga4', 'measurementId'],
  gtm: ['gtm', 'containerId'],
  metaPixel: ['meta', 'pixelId'],
  tiktokPixel: ['tiktok', 'pixelId'],
  googleAds: ['googleAds', 'conversionId'],
  linkedinPartner: ['linkedin', 'partnerId'],
  clarityProject: ['clarity', 'projectId'],
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
  vercel: ['vercel'],
}

const flag = (value: string) => value !== 'false'

/** Merges `window.ConsentLayer` with the script tag's `data-` attributes; an attribute wins over the same option in the object. */
export function readConfig(global: GlobalConfig | undefined, script: HTMLOrSVGScriptElement | null): GlobalConfig {
  const config: GlobalConfig = { ...global }
  const providers: Record<string, Record<string, unknown>> = {}
  const adapters: Record<string, Record<string, unknown>> = {}
  for (const [name, options] of Object.entries(global?.providers ?? {})) providers[name] = { ...options }
  for (const [name, options] of Object.entries(global?.adapters ?? {})) adapters[name] = { ...options }
  if (script instanceof HTMLScriptElement && script.nonce) config.nonce ??= script.nonce
  const dataset = script instanceof HTMLScriptElement ? script.dataset : {}
  for (const [key, value] of Object.entries(dataset)) {
    if (value === undefined) continue
    if (key === 'autoTracking') config.autoTracking = flag(value)
    else if (key === 'debug') config.debug = flag(value)
    else if (key === 'region') config.consent = { ...config.consent, region: value }
    else if (adapterFactories[key]) {
      if (flag(value)) adapters[key] ??= {}
      else delete adapters[key]
    } else if (attributes[key]) {
      const [provider, option, isFlag] = attributes[key]
      if (!option && !flag(value)) delete providers[provider]
      else providers[provider] ??= {}
      if (option) providers[provider][option] = isFlag ? flag(value) : value
    }
  }
  config.providers = providers
  if (Object.keys(adapters).length) config.adapters = adapters
  else delete config.adapters
  return config
}

/** Creates the instance and its consent controller from a `GlobalConfig`, starts them and sends a page view per URL. */
export function createGlobal(config: GlobalConfig) {
  const {
    providers = {},
    adapters: adapterOptions = {},
    boot,
    autoShowBanner,
    openConsentGlobalKey,
    autoTracking: tracking,
    ...options
  } = config
  const plugins: AnalyticsPlugin[] = []
  const adapters = [...(options.consent?.adapters ?? [])]
  for (const [name, providerOptions] of Object.entries(providers)) {
    if (factories[name]) plugins.push(factories[name](providerOptions as never))
    else console.warn(`[consentlayer] Unknown provider "${name}".`)
  }
  for (const [name, settings] of Object.entries(adapterOptions)) {
    if (adapterFactories[name]) adapters.push(adapterFactories[name](settings as never))
    else console.warn(`[consentlayer] Unknown adapter "${name}".`)
  }
  setPostHogHost(providers.posthog?.apiHost as string | undefined)
  const analytics = createAnalytics({
    ...options,
    providers: plugins,
    consent: { ...options.consent, adapters },
    autoTracking: tracking ? autoTracking(tracking === true ? undefined : tracking) : undefined,
  })
  const controller = createConsentController(analytics, { boot, autoShowBanner, openConsentGlobalKey })
  controller.start()
  const route = () => controller.setRoute(location.pathname + location.search)
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history)
    history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args)
      route()
    }
  }
  addEventListener('popstate', route)
  route()
  return { ...analytics, controller }
}

type ConsentLayerGlobal = ReturnType<typeof createGlobal>
