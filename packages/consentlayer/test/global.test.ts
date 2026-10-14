import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createConsentController } from '../src/core/consent-controller'
import { createAnalytics } from '../src/core/create-analytics'
import { mountBanner, readBannerConfig } from '../src/global/banner'
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
    })
  })
})

describe('createGlobal', () => {
  it('warns about an unknown provider and returns the instance with its controller', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const global = createGlobal({ providers: { nope: {} } })
    await settle()
    expect(warn).toHaveBeenCalledWith('[consentlayer] Unknown provider "nope".')
    expect(global.controller.getSnapshot().ready).toBe(true)
    expect(typeof global.track).toBe('function')
    global.destroy()
    warn.mockRestore()
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
  const setup = async (config = {}) => {
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
    const tag = script({ privacyPolicyUrl: '/privacy', textAcceptAll: 'Allow all' })
    expect(readBannerConfig({ text: { title: 'Cookies!', acceptAll: 'Yes' } }, tag)).toEqual({
      privacyPolicyUrl: '/privacy',
      text: { title: 'Cookies!', acceptAll: 'Allow all' },
    })
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
    await click('.consentlayer-banner', 'Reject non-essential')
    expect(analytics.consent.getConsent()).toMatchObject({ preferences: false, analytics: false, marketing: false })
    unmount()
    analytics.destroy()
  })

  it('saves the toggles from the settings dialog', async () => {
    const { analytics, unmount } = await setup()
    await click('.consentlayer-banner', 'Customize')
    const dialog = document.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(dialog.getAttribute('aria-labelledby')).toBe('consentlayer-dialog-title')
    expect(document.querySelector<HTMLElement>('.consentlayer-banner')!.hidden).toBe(false)
    const analyticsToggle = [...dialog.querySelectorAll('label')].find((label) => label.textContent?.startsWith('Analytics'))!
    analyticsToggle.querySelector('input')!.click()
    await click('dialog', 'Save')
    expect(analytics.consent.getConsent()).toMatchObject({ preferences: false, analytics: true, marketing: false })
    expect(dialog.open).toBe(false)
    unmount()
    analytics.destroy()
  })
})
