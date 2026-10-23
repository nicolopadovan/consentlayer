import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createConsentController } from '../src/core/consent-controller'
import { createAnalytics } from '../src/core/create-analytics'
import { mountBanner, type BannerOptions } from '../src/banner'
import { readBannerConfig } from '../src/global/banner'
import { setPostHogHost } from '../src/global/cdn/posthog-host'
import { createGlobal, readConfig } from '../src/global/config'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const script = (data: Record<string, string>) => {
  const element = document.createElement('script')
  Object.assign(element.dataset, data)
  return element
}

const preload = (src: string) => {
  const element = document.createElement('script')
  element.src = src
  document.head.append(element)
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  localStorage.clear()
  document.body.replaceChildren()
})

describe('readConfig', () => {
  it('keeps window.ConsentLayer options and its providers object', () => {
    const config = readConfig({ providers: { ga4: { measurementId: 'G-1' } }, autoTracking: true }, null)
    expect(config).toEqual({ providers: { ga4: { measurementId: 'G-1' } }, autoTracking: true })
  })

  it('reads providers and flags from data- attributes, which win over the object', () => {
    const tag = script({
      ga4: 'G-2',
      metaPixel: '123',
      tiktokPixel: 'TT',
      posthogKey: 'phc_1',
      posthogHost: 'https://eu.i.posthog.com',
      posthogRecording: '',
      sentryDsn: 'https://k@o1.ingest.sentry.io/1',
      sentryReplay: 'false',
      vercel: '',
      tcf: '',
      googleConsentMode: '',
      autoTracking: '',
      debug: 'false',
    })
    const config = readConfig({ providers: { ga4: { measurementId: 'G-1', urlPassthrough: true } } }, tag)
    expect(config).toEqual({
      autoTracking: true,
      debug: false,
      providers: {
        ga4: { measurementId: 'G-2', urlPassthrough: true },
        meta: { pixelId: '123' },
        tiktok: { pixelId: 'TT' },
        posthog: { apiKey: 'phc_1', apiHost: 'https://eu.i.posthog.com', recording: true },
        sentry: { dsn: 'https://k@o1.ingest.sentry.io/1', replay: false },
        vercel: {},
      },
      adapters: { tcf: {}, googleConsentMode: {} },
    })
  })

  it('reads Google Ads, LinkedIn and Clarity, keeping the events maps from the object', () => {
    const tag = script({ googleAds: 'AW-123', linkedinPartner: '456', clarityProject: 'abc123' })
    const config = readConfig(
      { providers: { googleAds: { events: { purchase: 'label' } }, linkedin: { events: { sign_up: 7 } } } },
      tag,
    )
    expect(config.providers).toEqual({
      googleAds: { conversionId: 'AW-123', events: { purchase: 'label' } },
      linkedin: { partnerId: '456', events: { sign_up: 7 } },
      clarity: { projectId: 'abc123' },
    })
    const warn = vi.spyOn(console, 'warn')
    createGlobal(config).destroy()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('turns an adapter or an option-less provider off with "false"', () => {
    const tag = script({ vercel: 'false', tcf: 'false', shopify: 'false', googleConsentMode: 'false' })
    const config = readConfig({ providers: { vercel: {} }, adapters: { tcf: {} } }, tag)
    expect(config).toEqual({ providers: {} })
  })
})

describe('createGlobal', () => {
  it('warns about an unknown provider and returns the instance with its controller', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const global = createGlobal({ providers: { nope: {} }, adapters: { nah: {} } })
    await settle()
    expect(warn).toHaveBeenCalledWith('[consentlayer] Unknown provider "nope".')
    expect(warn).toHaveBeenCalledWith('[consentlayer] Unknown adapter "nah".')
    expect(global.controller.getSnapshot().ready).toBe(true)
    expect(typeof global.track).toBe('function')
    global.destroy()
    warn.mockRestore()
  })
})

describe('data-auto-tracking', () => {
  it('starts auto-tracking from the attribute once analytics is granted', async () => {
    history.replaceState({}, '', '/?q=mugs')
    const global = createGlobal(readConfig(undefined, script({ autoTracking: '' })))
    const track = vi.fn()
    global.registerProvider({ id: 'spy', requiredConsent: 'analytics', track })
    await global.consent.update({ analytics: true })
    await vi.waitFor(() =>
      expect(track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'consentlayer.site_search' }),
        expect.anything(),
      ),
    )
    global.destroy()
    history.replaceState({}, '', '/')
  })
})

describe('CDN shims', () => {
  // The test runner awaits each module it imports, which resolves these thenable shims too.
  it('resolve to the window globals once the vendor script has loaded', async () => {
    const sentry = { init: vi.fn() }
    const posthog = { init: vi.fn() }
    Object.assign(window, { Sentry: sentry, posthog })
    setPostHogHost('https://eu.i.posthog.com')
    preload('https://browser.sentry-cdn.com/11.7.0/bundle.tracing.replay.min.js')
    preload('https://eu-assets.i.posthog.com/static/array.js')
    preload('https://eu-assets.i.posthog.com/static/lazy-recorder.js')

    expect(await import('../src/global/cdn/sentry')).toBe(sentry)
    expect(await import('../src/global/cdn/posthog')).toEqual({ default: posthog })
    expect(await import('../src/global/cdn/posthog-recorder')).toEqual({})
  })
})

describe('banner', () => {
  const setup = async (config: BannerOptions = {}) => {
    const analytics = createAnalytics({ providers: [] })
    const controller = createConsentController(analytics)
    controller.start()
    const unmount = mountBanner(controller, config)
    await settle()
    return { analytics, controller, unmount }
  }
  const click = async (selector: string, label: string) => {
    const button = [...document.querySelectorAll<HTMLButtonElement>(`${selector} button`)].find(
      (node) => node.textContent === label,
    )
    button!.click()
    await settle()
  }

  it('reads the privacy policy URL and text overrides from data- attributes', () => {
    const tag = script({
      privacyPolicyUrl: '/privacy',
      cookiePolicyUrl: '/cookies',
      termsUrl: '/terms',
      textAcceptAll: 'Allow all',
    })
    expect(readBannerConfig({ text: { title: 'Cookies!', acceptAll: 'Yes' } }, tag)).toEqual({
      privacyPolicyUrl: '/privacy',
      cookiePolicyUrl: '/cookies',
      termsUrl: '/terms',
      text: { title: 'Cookies!', acceptAll: 'Allow all' },
    })
  })

  it('builds links and bold text from the text, never markup or script URLs', async () => {
    const message = () => document.querySelector('.consentlayer-banner p')!.innerHTML
    const first = await setup({
      privacyPolicyUrl: '/privacy',
      cookiePolicyUrl: '/cookies',
      termsUrl: '/terms',
      text: {
        message:
          'Read our {cookiePolicy} and [notice](https://example.com/n), **not** <b>[this](javascript:alert)</b>.',
      },
    })
    expect(message()).toBe(
      'Read our <a href="/cookies">Cookie policy</a> and <a href="https://example.com/n">notice</a>, ' +
        '<strong>not</strong> &lt;b&gt;this&lt;/b&gt;. <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms of service</a>',
    )
    first.unmount()
    first.analytics.destroy()
    const { analytics, unmount } = await setup({ text: { message: 'See {privacyPolicy}.' } })
    expect(message()).toBe('See Privacy policy.')
    unmount()
    analytics.destroy()
  })

  it('follows the laws from window.ConsentLayer, and a data- text over them', async () => {
    const global = createGlobal(readConfig({ consent: { laws: { ccpa: true } } }, script({ region: 'US-CA' })))
    const unmount = mountBanner(global.controller, readBannerConfig(undefined, script({ textBadge: 'Privacy' })))
    await settle()
    const badge = document.querySelector<HTMLButtonElement>('.consentlayer-badge')!
    expect([badge.hidden, badge.textContent]).toEqual([false, 'Privacy'])
    expect(document.querySelector<HTMLElement>('.consentlayer-banner')!.hidden).toBe(true)
    unmount()
    global.destroy()
  })

  it('reads the placement and the badge from data- attributes', () => {
    const tag = script({
      position: 'top',
      overlay: '',
      blocking: '',
      emphasis: 'accept',
      badge: 'always',
      badgePosition: 'right',
      badgeLabel: '',
      badgeAttached: '',
    })
    expect(readBannerConfig(undefined, tag)).toEqual({
      position: 'top',
      overlay: true,
      blocking: true,
      emphasis: 'accept',
      badge: { show: 'always', position: 'right', label: true, attached: true },
      text: {},
    })
    expect(readBannerConfig({ badge: { position: 'left' } }, script({ badge: 'false' })).badge).toBe(false)
    expect(readBannerConfig({ badge: false }, script({ badgePosition: 'right', badge: 'always' })).badge).toEqual({
      show: 'always',
      position: 'right',
    })
  })

  it('lays out the top and bottom positions as a bar and the others as a card, dimmed or blocking on request', async () => {
    const layout = async (config: BannerOptions) => {
      const { analytics, unmount } = await setup(config)
      const banner = document.querySelector<HTMLElement>('.consentlayer-banner')!
      const result = [banner.tagName, banner.dataset.layout, banner.dataset.position, 'overlay' in banner.dataset]
      unmount()
      analytics.destroy()
      return result
    }
    expect(await layout({})).toEqual(['SECTION', 'card', 'bottom-left', false])
    expect(await layout({ position: 'top', overlay: true })).toEqual(['SECTION', 'bar', 'top', true])
    expect(await layout({ position: 'center', blocking: true })).toEqual(['DIALOG', 'card', 'center', false])
  })

  it('shows the badge once the visitor has chosen, and it reopens the settings', async () => {
    const { analytics, unmount } = await setup()
    const badge = document.querySelector<HTMLButtonElement>('.consentlayer-badge')!
    expect(badge.hidden).toBe(true)
    await click('.consentlayer-banner', 'Reject non-essential')
    expect(badge.hidden).toBe(false)
    expect(badge.getAttribute('aria-label')).toBe('Cookie settings')
    badge.click()
    await settle()
    expect(document.querySelector('dialog')!.open).toBe(true)
    unmount()
    expect(document.querySelector('.consentlayer-badge')).toBeNull()
    analytics.destroy()
  })

  it('shows the badge always, with its label, or not at all', async () => {
    const first = await setup({ badge: { show: 'always', label: true } })
    const badge = document.querySelector<HTMLButtonElement>('.consentlayer-badge')!
    expect(badge.hidden).toBe(false)
    expect(badge.textContent).toBe('Cookie settings')
    expect(badge.hasAttribute('aria-label')).toBe(false)
    first.unmount()
    first.analytics.destroy()
    const { analytics, unmount } = await setup({ badge: false })
    expect(document.querySelector('.consentlayer-badge')).toBeNull()
    unmount()
    analytics.destroy()
  })

  it('shows until the visitor accepts all', async () => {
    const { analytics, unmount } = await setup({ privacyPolicyUrl: '/privacy', text: { acceptAll: 'Allow all' } })
    const banner = document.querySelector<HTMLElement>('.consentlayer-banner')!
    expect(banner.hidden).toBe(false)
    expect(banner.querySelector('a')?.getAttribute('href')).toBe('/privacy')
    await click('.consentlayer-banner', 'Allow all')
    expect(analytics.consent.getConsent()).toMatchObject({ preferences: true, analytics: true, marketing: true })
    expect(banner.hidden).toBe(true)
    unmount()
    analytics.destroy()
  })

  it('says when the Global Privacy Control signal is on', async () => {
    const text = () => document.querySelector('.consentlayer-gpc')?.textContent
    const first = await setup()
    expect(text()).toBeUndefined()
    first.unmount()
    first.analytics.destroy()
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true })
    const { analytics, unmount } = await setup({ text: { gpc: 'GPC honored' } })
    expect(text()).toBe('GPC honored')
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: undefined, configurable: true })
    unmount()
    analytics.destroy()
  })

  it('rejects non-essential categories', async () => {
    const { analytics, unmount } = await setup()
    expect(document.querySelector('.consentlayer-banner .consentlayer-close')).toBeNull()
    await click('.consentlayer-banner', 'Reject non-essential')
    expect(analytics.consent.getConsent()).toMatchObject({ preferences: false, analytics: false, marketing: false })
    unmount()
    analytics.destroy()
  })

  it('gives Reject and Accept the same weight unless told to stress Accept', async () => {
    const weights = () =>
      ['Reject non-essential', 'Accept all'].map((label) =>
        [...document.querySelectorAll<HTMLButtonElement>('.consentlayer-banner button')]
          .find((node) => node.textContent === label)!
          .classList.contains('consentlayer-secondary'),
      )
    const first = await setup()
    expect(weights()).toEqual([false, false])
    first.unmount()
    first.analytics.destroy()
    const { analytics, unmount } = await setup({ emphasis: 'accept' })
    expect(weights()).toEqual([true, false])
    unmount()
    analytics.destroy()
  })

  it('accepts all from the settings dialog, and its × closes it without a choice', async () => {
    const { analytics, unmount } = await setup()
    await click('.consentlayer-banner', 'Customize')
    const dialog = document.querySelector('dialog')!
    expect(dialog.querySelector('[role=switch]')).not.toBeNull()
    dialog.querySelector<HTMLButtonElement>('.consentlayer-close')!.click()
    await settle()
    expect(dialog.open).toBe(false)
    expect(analytics.consent.getConsent()).toBeNull()
    await click('.consentlayer-banner', 'Customize')
    await click('dialog', 'Accept all')
    expect(analytics.consent.getConsent()).toMatchObject({ preferences: true, analytics: true, marketing: true })
    expect(dialog.open).toBe(false)
    unmount()
    analytics.destroy()
  })

  it('rejects non-essential categories from the × button', async () => {
    const { analytics, unmount } = await setup({ closeButton: true })
    const close = document.querySelector<HTMLButtonElement>('.consentlayer-close')!
    expect(close.getAttribute('aria-label')).toBe('Continue without accepting')
    close.click()
    await settle()
    expect(analytics.consent.getConsent()).toMatchObject({ preferences: false, analytics: false, marketing: false })
    expect(document.querySelector<HTMLElement>('.consentlayer-banner')!.hidden).toBe(true)
    unmount()
    analytics.destroy()
  })

  it('closes the blocking banner once the visitor chooses', async () => {
    const { analytics, unmount } = await setup({ blocking: true })
    const banner = document.querySelector<HTMLDialogElement>('.consentlayer-banner')!
    expect(banner.open).toBe(true)
    await click('.consentlayer-banner', 'Accept all')
    expect(banner.open).toBe(false)
    unmount()
    analytics.destroy()
  })

  it('saves the toggles from the settings dialog', async () => {
    const { analytics, unmount } = await setup({ text: { settingsMessage: 'Choose **what** we use.' } })
    await click('.consentlayer-banner', 'Customize')
    const dialog = document.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(dialog.querySelector('p')!.innerHTML).toBe('Choose <strong>what</strong> we use.')
    expect(dialog.getAttribute('aria-labelledby')).toBe('consentlayer-dialog-title')
    expect(document.querySelector<HTMLElement>('.consentlayer-banner')!.hidden).toBe(true)
    const analyticsToggle = [...dialog.querySelectorAll('label')].find((label) =>
      label.textContent?.startsWith('Analytics'),
    )!
    analyticsToggle.querySelector('input')!.click()
    await click('dialog', 'Save choices')
    expect(analytics.consent.getConsent()).toMatchObject({ preferences: false, analytics: true, marketing: false })
    expect(dialog.open).toBe(false)
    unmount()
    analytics.destroy()
  })
})

describe('the Sentry CDN bundle', () => {
  it('has the @sentry/browser version the package is developed against', () => {
    const source = readFileSync('src/global/cdn/sentry.ts', 'utf8')
    const { devDependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as {
      devDependencies: Record<string, string>
    }
    expect(source).toContain(`https://browser.sentry-cdn.com/${devDependencies['@sentry/browser']?.replace('^', '')}/`)
  })
})
