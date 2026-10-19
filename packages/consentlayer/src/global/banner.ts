import { mountBanner, type BannerOptions } from '../banner'

/** `window.ConsentLayer.banner`. */
export type BannerConfig = Omit<BannerOptions, 'nonce'>

/** Merges `window.ConsentLayer.banner` with the banner script's `data-position`, `data-overlay`, `data-blocking`, `data-close-button`, `data-emphasis`, `data-badge`, `data-badge-position`, `data-badge-label`, `data-badge-attached`, `data-privacy-policy-url`, `data-cookie-policy-url`, `data-terms-url` and `data-text-*` attributes; an attribute wins. */
export function readBannerConfig(
  global: BannerConfig | undefined,
  script: HTMLOrSVGScriptElement | null,
): BannerConfig {
  const config: BannerConfig = { ...global, text: { ...global?.text } }
  const dataset = script instanceof HTMLScriptElement ? script.dataset : {}
  const entries = Object.entries(dataset).sort(([a], [b]) => Number(b === 'badge') - Number(a === 'badge'))
  for (const [key, value] of entries) {
    if (value === undefined) continue
    if (key === 'privacyPolicyUrl' || key === 'cookiePolicyUrl' || key === 'termsUrl') config[key] = value
    else if (key === 'position') config.position = value as BannerConfig['position']
    else if (key === 'overlay') config.overlay = value !== 'false'
    else if (key === 'blocking') config.blocking = value !== 'false'
    else if (key === 'closeButton') config.closeButton = value !== 'false'
    else if (key === 'emphasis') config.emphasis = value as BannerConfig['emphasis']
    else if (key === 'badge' && value === 'false') config.badge = false
    else if (/^badge/.test(key) && (key === 'badge' || config.badge !== false)) {
      const badge = (config.badge = { ...(config.badge || {}) })
      if (key === 'badge') badge.show = value as 'after-choice' | 'always'
      else if (key === 'badgePosition') badge.position = value as NonNullable<typeof badge.position>
      else if (key === 'badgeLabel') badge.label = value !== 'false'
      else if (key === 'badgeAttached') badge.attached = value !== 'false'
    } else if (/^text[A-Z]/.test(key)) config.text![key[4].toLowerCase() + key.slice(5)] = value
  }
  return config
}

const script = document.currentScript
const start = () => {
  const global = window.ConsentLayer
  if (!global || !('controller' in global)) addEventListener('consentlayer:ready', start, { once: true })
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else mountBanner(global.controller, { ...readBannerConfig(global.banner, script), nonce: script?.nonce })
}
start()
