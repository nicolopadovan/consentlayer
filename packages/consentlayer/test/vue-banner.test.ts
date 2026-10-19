import { afterEach, expect, it } from 'vitest'
import { createApp, h, nextTick, shallowRef } from 'vue'
import type { BannerOptions } from '../src/banner'
import { createAnalytics } from '../src/core/create-analytics'
import { consentLayer } from '../src/vue'
import { ConsentBanner } from '../src/vue/banner'

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

const mount = (render: () => ReturnType<typeof h>) => {
  const analytics = createAnalytics({ providers: [] })
  const app = createApp({ render })
  app.use(consentLayer, { analytics })
  const element = document.body.appendChild(document.createElement('div'))
  app.mount(element)
  return { analytics, app, element }
}

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  document.head.innerHTML = ''
})

it('mounts the banner, records the choice and removes everything on unmount', async () => {
  const { analytics, app, element } = mount(() => h(ConsentBanner, { position: 'bottom' }))
  await settle()

  const banner = document.querySelector<HTMLElement>('.consentlayer-banner')!
  expect(banner.dataset.position).toBe('bottom')
  expect(banner.hidden).toBe(false)
  expect(element.innerHTML).toBe('<!---->')

  const accept = [...banner.querySelectorAll('button')].find((button) => button.textContent === 'Accept all')!
  accept.click()
  await settle()
  expect(analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: true })

  app.unmount()
  expect(document.querySelector('.consentlayer-banner, .consentlayer-dialog, .consentlayer-badge')).toBeNull()
  expect(document.head.querySelector('style')).toBeNull()
  analytics.destroy()
})

it('re-mounts when a prop changes', async () => {
  const position = shallowRef<BannerOptions['position']>('bottom')
  const { analytics, app } = mount(() => h(ConsentBanner, { position: position.value }))
  await settle()

  position.value = 'top'
  await settle()
  const banners = [...document.querySelectorAll<HTMLElement>('.consentlayer-banner')]
  expect(banners.map((banner) => banner.dataset.position)).toEqual(['top'])
  app.unmount()
  analytics.destroy()
})

it('re-mounts only when an object prop changes by value', async () => {
  const title = shallowRef('Cookies')
  const renders = shallowRef(0)
  const { analytics, app } = mount(() => {
    void renders.value
    return h(ConsentBanner, { text: { title: title.value } })
  })
  await settle()
  const banner = document.querySelector('.consentlayer-banner')

  renders.value++
  await settle()
  expect(document.querySelector('.consentlayer-banner')).toBe(banner)

  title.value = 'Privacy'
  await settle()
  const banners = [...document.querySelectorAll('.consentlayer-banner')]
  expect(banners.map((node) => node.querySelector('h2')?.textContent)).toEqual(['Privacy'])
  app.unmount()
  analytics.destroy()
})

it('throws without the plugin', () => {
  const app = createApp({ render: () => h(ConsentBanner) })
  app.config.warnHandler = () => {}
  expect(() => app.mount(document.createElement('div'))).toThrow('ConsentBanner needs app.use(consentLayer)')
})
