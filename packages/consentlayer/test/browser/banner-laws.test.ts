import { afterEach, beforeEach, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mountBanner, type BannerOptions } from '../../src/banner'
import { createAnalytics, createConsentController, type AnalyticsOptions, type Law } from '../../src/index'

let cleanup = () => {}

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1280, 800)
  document.body.innerHTML = '<main><button type="button">Page button</button></main>'
})
afterEach(() => cleanup())

async function setup(where: string | Law[], options: BannerOptions = {}, consent: AnalyticsOptions['consent'] = {}) {
  const region = typeof where === 'string' ? where : 'XX'
  const regions = typeof where === 'string' ? undefined : { XX: { laws: where } }
  const analytics = createAnalytics({ providers: [], consent: { ...consent, region, regions } })
  const controller = createConsentController(analytics)
  const stop = controller.start()
  const unmount = mountBanner(controller, options)
  cleanup = () => {
    unmount()
    stop()
    analytics.destroy()
  }
  await expect.poll(() => controller.getSnapshot().ready).toBe(true)
  await expect.poll(() => visible(banner()) || visible(badge())).toBe(true)
  await animations()
}

const animations = () => Promise.allSettled(document.getAnimations().map((animation) => animation.finished))
const banner = () => document.querySelector<HTMLElement>('.consentlayer-banner')
const badge = () => document.querySelector<HTMLElement>('.consentlayer-badge')
const dialog = () => document.querySelector<HTMLDialogElement>('.consentlayer-dialog')!
const visible = (node: Element | null) => !!node && node.checkVisibility() && node.getBoundingClientRect().height > 0
const rect = (node: Element) => node.getBoundingClientRect()
const button = (label: string) => page.getByRole('button', { name: label, exact: true })
const inside = (node: Element) => {
  const box = rect(node)
  return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight
}
const filled = (label: string) => getComputedStyle(button(label).element()).backgroundColor !== 'rgba(0, 0, 0, 0)'

const breakpoints = [
  [320, 568],
  [375, 667],
  [768, 1024],
  [1280, 800],
  [1920, 1080],
] as const

for (const [width, height] of breakpoints) {
  it(`lays out the Your Privacy Choices badge and its dialog at ${width}×${height}`, async () => {
    await page.viewport(width, height)
    await setup('US-CA')
    expect(visible(banner())).toBe(false)
    const node = badge()!
    expect([inside(node), node.scrollWidth <= node.clientWidth]).toEqual([true, true])
    const icon = rect(node.querySelector('svg')!)
    expect([Math.round(icon.width / icon.height), icon.height >= 14]).toEqual([2, true])
    await button('Your Privacy Choices').click()
    await animations()
    expect(inside(dialog())).toBe(true)
    const label = dialog().querySelector('label')!
    expect(label.scrollWidth <= label.clientWidth).toBe(true)
  })

  it(`lays out the CNIL banner with its × at ${width}×${height}`, async () => {
    await page.viewport(width, height)
    await setup('FR')
    expect(inside(banner()!)).toBe(true)
    const close = button('Continue without accepting').element()
    expect([visible(close), banner()!.contains(close)]).toEqual([true, true])
    const message = rect(banner()!.querySelector('p')!)
    expect(rect(close).bottom <= message.top || rect(close).left >= message.right).toBe(true)
  })
}

it('fills Accept and Reject alike under GDPR, and only Accept under the revFADP', async () => {
  await setup('DE')
  expect([filled('Accept all'), filled('Reject non-essential')]).toEqual([true, true])
  cleanup()
  await setup('CH')
  expect([filled('Accept all'), filled('Reject non-essential')]).toEqual([true, false])
  cleanup()
  await setup('CH', { emphasis: 'equal' })
  expect([filled('Accept all'), filled('Reject non-essential')]).toEqual([true, true])
})

it('reaches the opt-out switch with the keyboard and returns focus to the badge', async () => {
  await setup('US-CA')
  badge()!.focus()
  await userEvent.keyboard('{Enter}')
  await expect.poll(() => dialog().open).toBe(true)
  const order = [document.activeElement!]
  for (let i = 0; i < 2; i++) {
    await userEvent.tab()
    order.push(document.activeElement!)
  }
  expect(
    order.map((node) => node.getAttribute('aria-label') ?? node.closest('label')?.textContent ?? node.textContent),
  ).toEqual(['Close', expect.stringContaining('Do not sell or share my personal information'), 'Save choices'])
  await userEvent.tab({ shift: true })
  await userEvent.keyboard(' ')
  await userEvent.tab()
  await userEvent.keyboard('{Enter}')
  await expect.poll(() => dialog().open).toBe(false)
  await expect.poll(() => document.activeElement).toBe(badge())
  expect((JSON.parse(localStorage.getItem('consentlayer_consent')!) as { consent: unknown }).consent).toEqual({
    preferences: true,
    analytics: true,
    marketing: false,
  })
})

it('keeps the opt-in banner above the Your Privacy Choices badge where GDPR applies too', async () => {
  await setup(['ccpa', 'gdpr'])
  expect([visible(banner()), visible(badge())]).toEqual([true, true])
  const box = rect(badge()!)
  expect(banner()!.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true)
})
