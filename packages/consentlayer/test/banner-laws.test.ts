import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mountBanner, type BannerOptions } from '../src/banner'
import { createConsentController } from '../src/core/consent-controller'
import { createAnalytics, type AnalyticsOptions } from '../src/core/create-analytics'
import type { AnalyticsPlugin, Law } from '../src/core/types'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const signal = (value: boolean | undefined) =>
  Object.defineProperty(navigator, 'globalPrivacyControl', { value, configurable: true })

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

let cleanup = () => {}
afterEach(() => {
  cleanup()
  localStorage.clear()
  signal(undefined)
  document.body.replaceChildren()
})

const stored = () => (JSON.parse(localStorage.getItem('consentlayer_consent')!) as { consent: unknown }).consent

/** Mounts the banner for a visitor in `region`, or under `laws` in a made-up region. */
async function setup(where: string | Law[], options: BannerOptions = {}, consent: AnalyticsOptions['consent'] = {}) {
  const ads = { id: 'ads', requiredConsent: 'marketing', load: vi.fn() } satisfies AnalyticsPlugin
  const stats = { id: 'stats', requiredConsent: 'analytics', load: vi.fn() } satisfies AnalyticsPlugin
  const region = typeof where === 'string' ? where : 'XX'
  const regions = typeof where === 'string' ? consent.regions : { XX: { laws: where } }
  const analytics = createAnalytics({ providers: [stats, ads], consent: { ...consent, region, regions } })
  const controller = createConsentController(analytics)
  const stop = controller.start()
  const unmount = mountBanner(controller, options)
  cleanup = () => {
    unmount()
    stop()
    analytics.destroy()
  }
  await settle()
  await settle()
  return { analytics, controller, loaded: () => analytics.getSnapshot().activeProviders }
}

const banner = () => document.querySelector<HTMLElement>('.consentlayer-banner')!
const badge = () => document.querySelector<HTMLButtonElement>('.consentlayer-badge')!
const dialog = () => document.querySelector<HTMLDialogElement>('.consentlayer-dialog')!
const buttons = (root: Element) => [...root.querySelectorAll('button')].map((node) => node.textContent)
const find = (root: Element, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent === label || node.getAttribute('aria-label') === label,
  )!
const click = async (root: Element, label: string) => {
  find(root, label).click()
  await settle()
}
const secondary = (label: string) => find(banner(), label).classList.contains('consentlayer-secondary')
const switches = () =>
  [...dialog().querySelectorAll<HTMLInputElement>('input:not(:disabled)')].map(
    (input) => input.closest('label')!.querySelector('strong')!.textContent,
  )

describe('opt-in laws', () => {
  it.each([
    ['DE', {}],
    ['GB', { uk: true }],
    ['BR', { lgpd: true }],
    ['CA-QC', { quebec: true }],
  ] as const)(
    'show the banner in %s before anything loads, Accept and Reject alike, and keep the badge',
    async (region, laws) => {
      const { loaded } = await setup(region, {}, { laws })
      expect(banner().hidden).toBe(false)
      expect(loaded()).toEqual([])
      expect(buttons(banner())).toEqual(['Accept all', 'Reject non-essential', 'Customize'])
      expect([secondary('Accept all'), secondary('Reject non-essential')]).toEqual([false, false])
      expect(banner().querySelector('.consentlayer-close')).toBeNull()
      expect(badge().hidden).toBe(true)
      await click(banner(), 'Reject non-essential')
      expect(badge().hidden).toBe(false)
      expect(badge().getAttribute('aria-label')).toBe('Cookie settings')
    },
  )
})

describe('the CNIL', () => {
  it('adds an × that refuses, with a message that says so', async () => {
    const { loaded } = await setup('FR')
    expect(banner().querySelector('p')!.textContent).toContain('Closing this banner means you refuse')
    expect(find(banner(), 'Continue without accepting').classList.contains('consentlayer-close')).toBe(true)
    await click(banner(), 'Continue without accepting')
    expect(stored()).toEqual({ preferences: false, analytics: false, marketing: false })
    expect(loaded()).toEqual([])
    expect(badge().hidden).toBe(false)
  })

  it('leaves the × out once the message is your own, unless you add it', async () => {
    await setup('FR', { text: { message: 'Our cookies.' } })
    expect(banner().querySelector('.consentlayer-close')).toBeNull()
    cleanup()
    await setup('FR', { closeButton: true, text: { message: 'Our cookies. Closing refuses them.' } })
    expect(banner().querySelector('.consentlayer-close')).not.toBeNull()
  })

  it('keeps its message only with the ×', async () => {
    await setup('FR', { closeButton: false })
    expect(banner().querySelector('.consentlayer-close')).toBeNull()
    expect(banner().querySelector('p')!.textContent).not.toContain('Closing')
  })

  it('goes away with the cnil law', async () => {
    await setup('FR', {}, { laws: { cnil: false } })
    expect(banner().querySelector('.consentlayer-close')).toBeNull()
  })
})

describe('the revFADP', () => {
  it('shows a notice that offers Reject, stresses Accept and keeps the badge', async () => {
    const { loaded, analytics } = await setup('CH')
    expect(banner().hidden).toBe(false)
    expect(banner().querySelector('p')!.textContent).toContain('You can reject all but the necessary ones.')
    expect(loaded()).toEqual(['stats'])
    expect([secondary('Accept all'), secondary('Reject non-essential')]).toEqual([false, true])
    await click(banner(), 'Reject non-essential')
    expect(analytics.consent.getConsent()).toEqual({ preferences: false, analytics: false, marketing: false })
    expect(badge().hidden).toBe(false)
  })
})

describe('the CCPA', () => {
  it('shows no banner but a Your Privacy Choices badge with the opt-out icon', async () => {
    const { loaded } = await setup('US-CA')
    expect(banner().hidden).toBe(true)
    expect(loaded()).toEqual(['stats', 'ads'])
    expect(badge().hidden).toBe(false)
    expect(badge().textContent).toBe('Your Privacy Choices')
    expect(badge().querySelector('svg[data-choices]')).not.toBeNull()
  })

  it('opens a dialog whose one switch opts out of marketing', async () => {
    const { loaded } = await setup('US-CA')
    badge().click()
    await settle()
    expect(dialog().open).toBe(true)
    expect(dialog().querySelector('h2')!.textContent).toBe('Your Privacy Choices')
    expect(switches()).toEqual(['Do not sell or share my personal information'])
    expect(buttons(dialog())).toEqual(['×', 'Save choices'])
    const input = dialog().querySelector<HTMLInputElement>('input')!
    expect(input.checked).toBe(false)
    input.click()
    await click(dialog(), 'Save choices')
    expect(stored()).toEqual({ preferences: true, analytics: true, marketing: false })
    expect(loaded()).toEqual(['stats'])
    expect(badge().hidden).toBe(false)
    badge().click()
    await settle()
    expect(dialog().querySelector('input')!.checked).toBe(true)
  })

  it('states the right to opt out in the dialog', async () => {
    await setup('US-CA')
    expect(dialog().querySelector('h2 + p')!.textContent).toContain('right to opt out of the sale or sharing')
  })

  it('honors Global Privacy Control and says so, unless the note is turned off', async () => {
    signal(true)
    const { loaded } = await setup('US-CA')
    expect(loaded()).toEqual(['stats'])
    badge().click()
    await settle()
    expect(dialog().querySelector('input')!.checked).toBe(true)
    expect(dialog().querySelector('.consentlayer-gpc')!.textContent).toBe('Opt-Out Preference Signal Honored')
    cleanup()
    await setup('US-CA', { text: { gpcHonored: '' } })
    expect(dialog().querySelector('.consentlayer-gpc')).toBeNull()
    cleanup()
    signal(false)
    await setup('US-CA')
    expect(dialog().querySelector('.consentlayer-gpc')).toBeNull()
  })

  it('gives way to the opt-in banner when switched off', async () => {
    await setup('US-CA', {}, { laws: { ccpa: false } })
    expect(banner().hidden).toBe(false)
    expect(badge().hidden).toBe(true)
  })
})

describe('several laws', () => {
  it('under GDPR and the CCPA, asks first, with every switch, and keeps the Your Privacy Choices badge', async () => {
    const { loaded } = await setup(['ccpa', 'gdpr'])
    expect(banner().hidden).toBe(false)
    expect(loaded()).toEqual([])
    expect([secondary('Accept all'), secondary('Reject non-essential')]).toEqual([false, false])
    expect(badge().hidden).toBe(false)
    expect(badge().textContent).toBe('Your Privacy Choices')
    await click(banner(), 'Customize')
    expect(dialog().querySelector('h2')!.textContent).toBe('Cookie settings')
    expect(switches()).toEqual(['Preferences', 'Analytics', 'Marketing'])
  })

  it('under the revFADP and the CCPA, keeps the notice with the full settings', async () => {
    await setup(['revfadp', 'ccpa'])
    expect(banner().hidden).toBe(false)
    expect(secondary('Reject non-essential')).toBe(true)
    await click(banner(), 'Customize')
    expect(switches()).toEqual(['Preferences', 'Analytics', 'Marketing'])
  })

  it('under the revFADP and an opt-in law, gives Accept and Reject the same weight and asks for consent', async () => {
    const { loaded } = await setup(['revfadp', 'gdpr'])
    expect(loaded()).toEqual([])
    expect(secondary('Reject non-essential')).toBe(false)
    expect(banner().querySelector('p')!.textContent).toContain('with your consent')
  })

  it('under the revFADP and the CNIL, adds the × and its message', async () => {
    await setup(['revfadp', 'cnil'])
    expect(secondary('Reject non-essential')).toBe(false)
    expect(banner().querySelector('.consentlayer-close')).not.toBeNull()
    expect(banner().querySelector('p')!.textContent).toContain('Closing this banner means you refuse')
  })
})

describe('a slow region lookup', () => {
  it('mounts nothing until the region is known, then follows its law', async () => {
    let resolve = (_region: string) => {}
    const region = new Promise<string>((done) => (resolve = done))
    const analytics = createAnalytics({ consent: { region: () => region } })
    const controller = createConsentController(analytics)
    const stop = controller.start()
    const unmount = mountBanner(controller)
    cleanup = () => {
      unmount()
      stop()
      analytics.destroy()
    }
    await settle()
    expect(banner()).toBeNull()
    expect(badge()).toBeNull()
    resolve('US-CA')
    await settle()
    await settle()
    expect(banner().hidden).toBe(true)
    expect(badge().textContent).toBe('Your Privacy Choices')
  })
})

describe('your options', () => {
  it('override what a law would choose', async () => {
    await setup('CH', { emphasis: 'equal' })
    expect(secondary('Reject non-essential')).toBe(false)
    cleanup()
    await setup('FR', { closeButton: false })
    expect(banner().querySelector('.consentlayer-close')).toBeNull()
    cleanup()
    await setup('US-CA', { badge: { show: 'after-choice', label: false }, text: { badge: 'Privacy' } })
    expect(badge().hidden).toBe(true)
    expect(badge().getAttribute('aria-label')).toBe('Privacy')
    cleanup()
    await setup('US-CA', { badge: { position: 'right' } })
    expect([badge().hidden, badge().dataset.position, badge().textContent]).toEqual([
      false,
      'right',
      'Your Privacy Choices',
    ])
    cleanup()
    await setup('US-CA', { badge: false })
    expect(badge()).toBeNull()
    cleanup()
    await setup('US-CA', { text: { doNotSell: 'Opt out', settingsTitle: 'Privacy' } })
    badge().click()
    await settle()
    expect([dialog().querySelector('h2')!.textContent, switches()]).toEqual(['Privacy', ['Opt out']])
  })

  it('apply where no law does', async () => {
    await setup('JP', { emphasis: 'accept', closeButton: true })
    expect(secondary('Reject non-essential')).toBe(true)
    expect(banner().querySelector('.consentlayer-close')).not.toBeNull()
  })
})
