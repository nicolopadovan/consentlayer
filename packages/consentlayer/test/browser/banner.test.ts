import { afterEach, beforeEach, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mountBanner, type BannerOptions } from '../../src/banner'
import { createAnalytics, createConsentController } from '../../src/index'

let cleanup = () => {}

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1280, 800)
  document.body.innerHTML = '<main><button type="button">Page button</button></main>'
})
afterEach(() => cleanup())

async function setup(options: BannerOptions = {}) {
  const analytics = createAnalytics({ providers: [] })
  const controller = createConsentController(analytics)
  const stop = controller.start()
  const unmount = mountBanner(controller, options)
  cleanup = () => {
    unmount()
    stop()
    analytics.destroy()
  }
  await expect.poll(() => visible(banner())).toBe(true)
  await animations()
  return analytics
}

const animations = () => Promise.allSettled(document.getAnimations().map((animation) => animation.finished))
const banner = () => document.querySelector<HTMLElement>('.consentlayer-banner')!
const badge = () => document.querySelector<HTMLElement>('.consentlayer-badge')!
const visible = (node: Element | null) => !!node && node.checkVisibility() && node.getBoundingClientRect().height > 0
const rect = (node: Element) => node.getBoundingClientRect()
const button = (label: string) => page.getByRole('button', { name: label, exact: true })

for (const [label, options] of [
  ['the card', {}],
  ['the bar', { position: 'bottom' }],
  ['the blocking banner', { blocking: true }],
  ['the dimmed banner', { overlay: true }],
] as const) {
  for (const choice of ['Accept all', 'Reject non-essential']) {
    it(`hides ${label} after "${choice}"`, async () => {
      await setup(options)
      await button(choice).click()
      await expect.poll(() => visible(banner())).toBe(false)
    })
  }
}

it('puts the banner where its position says', async () => {
  const cases: [BannerOptions['position'], (box: DOMRect) => boolean][] = [
    [undefined, (box) => box.left === 16 && box.bottom === innerHeight - 16],
    ['top-right', (box) => box.top === 16 && box.right === innerWidth - 16],
    ['bottom-center', (box) => Math.abs(box.left + box.width / 2 - innerWidth / 2) < 1],
    ['center', (box) => Math.abs(box.top + box.height / 2 - innerHeight / 2) < 1],
    ['top', (box) => box.top === 0 && box.width === innerWidth],
    ['bottom', (box) => box.bottom === innerHeight && box.width === innerWidth],
  ]
  for (const [position, check] of cases) {
    await setup({ position })
    expect(check(rect(banner())), position).toBe(true)
    cleanup()
  }
})

it('turns the card into a full-width sheet on a phone', async () => {
  await page.viewport(375, 700)
  await setup()
  const box = rect(banner())
  expect([box.left, box.right, box.bottom]).toEqual([8, innerWidth - 8, innerHeight - 8])
})

it('blocks the page only when blocking', async () => {
  const pageButton = document.querySelector('main button') as HTMLButtonElement
  const { x, y } = rect(pageButton)
  await setup({ overlay: true })
  expect(document.elementFromPoint(x + 1, y + 1)).toBe(pageButton)
  cleanup()
  await setup({ blocking: true })
  expect(document.elementFromPoint(x + 1, y + 1)).not.toBe(pageButton)
  pageButton.focus()
  expect(document.activeElement).not.toBe(pageButton)
  await userEvent.keyboard('{Escape}')
  expect(visible(banner())).toBe(true)
})

it('rejects from the × button', async () => {
  await setup({ closeButton: true })
  await button('Continue without accepting').click()
  await expect.poll(() => visible(banner())).toBe(false)
  expect((JSON.parse(localStorage.getItem('consentlayer_consent')!) as { consent: unknown }).consent).toEqual({
    preferences: false,
    analytics: false,
    marketing: false,
  })
})

it('shows the badge after a choice, and it opens the settings', async () => {
  await setup()
  expect(visible(badge())).toBe(false)
  await button('Reject non-essential').click()
  await expect.poll(() => visible(badge())).toBe(true)
  expect(badge().getAnimations().length).toBeGreaterThan(0)
  await animations()
  expect(rect(badge()).left).toBe(16)
  await animations()
  await button('Cookie settings').click()
  const dialog = document.querySelector('.consentlayer-dialog')!
  await expect.poll(() => visible(dialog)).toBe(true)
  expect(dialog.contains(document.activeElement)).toBe(true)
})

it('attaches the badge to the edge', async () => {
  await setup({ badge: { show: 'always', attached: true } })
  await animations()
  expect(rect(badge()).left).toBe(0)
  cleanup()
  await setup({ badge: { show: 'always', attached: true, position: 'bottom-center' } })
  await animations()
  expect(rect(badge()).bottom).toBe(innerHeight)
})

it('reaches the banner buttons with Tab in the order they appear', async () => {
  await setup({ closeButton: true })
  const labels: string[] = []
  for (let i = 0; i < 6; i++) {
    await userEvent.tab()
    if (banner().contains(document.activeElement)) labels.push(document.activeElement!.textContent)
  }
  expect(labels).toEqual(['×', 'Accept all', 'Reject non-essential', 'Customize'])
})

it('centres the settings dialog even under a margin reset', async () => {
  const reset = document.createElement('style')
  reset.textContent = '@layer base{*{margin:0;padding:0}}'
  document.head.append(reset)
  await setup()
  await button('Customize').click()
  await animations()
  const box = rect(document.querySelector('.consentlayer-dialog')!)
  reset.remove()
  expect(Math.abs(box.left + box.width / 2 - innerWidth / 2)).toBeLessThan(1)
  expect(Math.abs(box.top + box.height / 2 - innerHeight / 2)).toBeLessThan(1)
})

it('saves the switches from the settings dialog', async () => {
  const analytics = await setup()
  await button('Customize').click()
  await page.getByRole('switch', { name: /Analytics/ }).click()
  await expect.element(page.getByRole('switch', { name: /Necessary/ })).toBeDisabled()
  await button('Save choices').click()
  expect(analytics.consent.getConsent()).toMatchObject({
    analytics: true,
    marketing: false,
  })
})

it('fills Reject like Accept unless emphasis is accept', async () => {
  const fill = (label: string) => getComputedStyle(button(label).element()).backgroundColor
  await setup()
  expect(fill('Reject non-essential')).toBe(fill('Accept all'))
  cleanup()
  await setup({ emphasis: 'accept' })
  expect(fill('Reject non-essential')).not.toBe(fill('Accept all'))
})

it('hides the banner while the settings are open, and focus returns to Customize', async () => {
  await setup()
  await button('Customize').click()
  await expect.poll(() => visible(banner())).toBe(false)
  await page.getByRole('button', { name: 'Close' }).click()
  await expect.poll(() => visible(banner())).toBe(true)
  expect(document.activeElement?.textContent).toBe('Customize')
})

const breakpoints = [
  [320, 568],
  [375, 667],
  [414, 896],
  [667, 375],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const

function expectLaidOut(container: HTMLElement, name: string) {
  const box = rect(container)
  expect([box.left >= 0, box.top >= 0, box.right <= innerWidth, box.bottom <= innerHeight], name).toEqual([
    true,
    true,
    true,
    true,
  ])
  for (const node of container.querySelectorAll<HTMLButtonElement>('.consentlayer-actions button')) {
    const own = rect(node)
    expect(node.scrollWidth <= node.clientWidth && own.left >= box.left && own.right <= box.right, name).toBe(true)
  }
  const widths = ['Reject non-essential', 'Accept all'].map(
    (label) => rect([...container.querySelectorAll('button')].find((node) => node.textContent === label)!).width,
  )
  expect(Math.abs(widths[0] - widths[1]), name).toBeLessThan(1)
  if (innerWidth <= 480) {
    const lefts = [...container.querySelectorAll('.consentlayer-actions button')].map((node) => rect(node).left)
    expect(new Set(lefts).size, `${name} stacks the buttons`).toBe(1)
    expect(container.querySelector('.consentlayer-actions button')!.textContent, `${name} puts Accept first`).toBe(
      'Accept all',
    )
  }
}

for (const [width, height] of breakpoints) {
  it(`lays out every position and the settings at ${width}×${height}`, async () => {
    await page.viewport(width, height)
    for (const position of ['bottom-left', 'bottom-center', 'bottom', 'center', 'top-right', 'top'] as const) {
      for (const blocking of [false, true]) {
        await setup({ position, blocking, closeButton: true })
        expectLaidOut(banner(), `${position}${blocking ? ' blocking' : ''} at ${width}px`)
        cleanup()
      }
    }
    await setup()
    await button('Customize').click()
    await animations()
    expectLaidOut(document.querySelector('.consentlayer-dialog')!, `settings at ${width}px`)
  })
}

it('stops the page scrolling while the settings or a blocking banner are open', async () => {
  await setup({ blocking: true })
  expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
  cleanup()
  await setup()
  expect(getComputedStyle(document.documentElement).overflow).toBe('visible')
  await button('Customize').click()
  expect(getComputedStyle(document.documentElement).overflow).toBe('hidden')
})

it('keeps the banner above an always-on badge', async () => {
  await setup({ badge: { show: 'always' } })
  await animations()
  const box = rect(badge())
  expect(banner().contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true)
})

it('returns focus to the badge when the settings close', async () => {
  await setup({ badge: { show: 'always' } })
  await button('Accept all').click()
  await expect.poll(() => visible(badge())).toBe(true)
  badge().focus()
  await userEvent.keyboard('{Enter}')
  await expect.poll(() => visible(document.querySelector('.consentlayer-dialog'))).toBe(true)
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => document.activeElement).toBe(badge())
})

it('reaches the settings controls with Tab in the order they appear', async () => {
  await setup()
  await button('Customize').click()
  const dialog = document.querySelector('.consentlayer-dialog')!
  const labels = [document.activeElement!]
  for (let i = 0; i < 6; i++) {
    await userEvent.tab()
    labels.push(document.activeElement!)
  }
  expect(
    labels.map(
      (node) =>
        node.getAttribute('aria-label') ??
        node.closest('label')?.querySelector('strong')?.textContent ??
        node.textContent,
    ),
  ).toEqual(['Close', 'Preferences', 'Analytics', 'Marketing', 'Accept all', 'Reject non-essential', 'Save choices'])
  expect(dialog.contains(document.activeElement)).toBe(true)
})

it('animates the badge out when the banner returns', async () => {
  const analytics = createAnalytics({ providers: [] })
  const controller = createConsentController(analytics)
  const stop = controller.start()
  const unmount = mountBanner(controller)
  cleanup = () => {
    unmount()
    stop()
    analytics.destroy()
  }
  await controller.actions.acceptAll()
  await expect.poll(() => visible(badge())).toBe(true)
  await animations()
  controller.actions.showBanner()
  expect(badge().getAnimations().length).toBeGreaterThan(0)
})

it('discards unsaved switches and returns focus to Customize after Escape', async () => {
  const analytics = await setup()
  await button('Customize').click()
  await page.getByRole('switch', { name: /Marketing/ }).click()
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => visible(banner())).toBe(true)
  expect(document.activeElement?.textContent).toBe('Customize')
  await button('Customize').click()
  await expect.element(page.getByRole('switch', { name: /Marketing/ })).not.toBeChecked()
  await button('Save choices').click()
  expect(analytics.consent.getConsent()).toMatchObject({ marketing: false })
})

it('puts the blocking bar at the bottom, full width', async () => {
  await setup({ position: 'bottom', blocking: true })
  const box = rect(banner())
  expect([box.left, box.right, box.bottom]).toEqual([0, innerWidth, innerHeight])
})

it('reserves the scrollbar gutter only when the page has a scrollbar', async () => {
  const root = document.documentElement
  await setup({ position: 'bottom', blocking: true })
  expect(root.hasAttribute('data-consentlayer-gutter')).toBe(false)
  cleanup()
  Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => innerWidth - 15 })
  await setup({ position: 'bottom', blocking: true })
  delete (root as { clientWidth?: number }).clientWidth
  expect(getComputedStyle(root).scrollbarGutter).toBe('stable')
  cleanup()
  expect(root.hasAttribute('data-consentlayer-gutter')).toBe(false)
})

it('separates the switch label from its description', async () => {
  await setup()
  await button('Customize').click()
  await expect.element(page.getByRole('switch', { name: /^Analytics \S/ })).toBeInTheDocument()
})

it('stays hidden under a host rule that sets display', async () => {
  const host = document.createElement('style')
  host.textContent = '.consentlayer-banner{display:flex}'
  document.head.append(host)
  await setup()
  await button('Accept all').click()
  await animations()
  expect(visible(banner())).toBe(false)
  host.remove()
})

it('leaves a placeholder inside a link label as text', async () => {
  await setup({
    privacyPolicyUrl: '/privacy',
    text: { message: 'Read {privacyPolicy}.', privacyPolicy: 'our {privacyPolicy}' },
  })
  expect(banner().querySelector('a')?.textContent).toBe('our {privacyPolicy}')
})
