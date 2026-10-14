import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, defineComponent, h, nextTick, type App, type Component } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { createAnalytics } from '../src/core/create-analytics'
import type { AnalyticsPlugin } from '../src/core/types'
import { renderToString } from 'vue/server-renderer'
import { consentLayer, MetaPixelNoscript, useAnalytics, useConsent, useConsentController } from '../src/vue'

const spyProvider = (id: string) =>
  ({ id, requiredConsent: 'analytics', page: vi.fn(), track: vi.fn() }) satisfies AnalyticsPlugin

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

const mount = (component: Component, install: (app: App) => void) => {
  const app = createApp(component)
  install(app)
  const element = document.createElement('div')
  document.body.append(element)
  app.mount(element)
  return { app, element }
}

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('consentlayer/vue', () => {
  it('renders the banner state and records the choice', async () => {
    const analytics = createAnalytics({ providers: [] })
    const Banner = defineComponent({
      setup() {
        const { bannerVisible, acceptAll } = useConsentController()
        const { consent } = useConsent()
        return () => [
          bannerVisible.value ? h('button', { id: 'accept', onClick: acceptAll }, 'Accept all') : null,
          h('pre', JSON.stringify(consent.value)),
        ]
      },
    })
    const { app, element } = mount(Banner, (app) => app.use(consentLayer, { analytics }))
    await settle()

    element.querySelector<HTMLButtonElement>('#accept')!.click()
    await settle()

    expect(element.querySelector('#accept')).toBeNull()
    expect(element.querySelector('pre')!.textContent).toContain('"marketing":true')
    app.unmount()
    analytics.destroy()
  })

  it('sends a page view per navigation, without the hash', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    const Page = defineComponent({ render: () => h('p') })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: Page }, { path: '/shop', component: Page }],
    })
    void router.push('/')
    const { app } = mount(defineComponent({ render: () => h(RouterView) }), (app) => {
      app.use(router)
      app.use(consentLayer, { analytics, router })
    })
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(1)

    await router.push('/shop?page=2')
    await settle()
    await router.push('/shop?page=2#reviews')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(2)
    app.unmount()
    analytics.destroy()
  })

  it('reports component errors and keeps the existing handler', () => {
    const analytics = createAnalytics({ providers: [] })
    const captureError = vi.spyOn(analytics, 'captureError')
    const previous = vi.fn()
    const Broken = defineComponent({
      setup() {
        throw new Error('broken')
      },
      render: () => null,
    })
    mount(Broken, (app) => {
      app.config.errorHandler = previous
      app.use(consentLayer, { analytics })
    })

    expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'broken' }), {
      source: 'boundary',
      tags: { vue_info: expect.any(String) as string },
    })
    expect(previous).toHaveBeenCalled()
    analytics.destroy()
  })

  it('falls back to the latest instance outside the plugin', () => {
    const analytics = createAnalytics({ providers: [] })
    let found: unknown
    mount(defineComponent({ setup: () => { found = useAnalytics(); return () => null } }), () => {})
    expect(found).toBe(analytics)
    analytics.destroy()
  })
})

describe('MetaPixelNoscript for Vue', () => {
  it('renders the pixel only when enabled with an ID', async () => {
    const render = (props: Record<string, unknown>) => renderToString(createSSRApp({ render: () => h(MetaPixelNoscript, props) }))
    expect(await render({ pixelId: '123', enabled: true, loading: 'lazy' })).toBe(
      '<noscript><img height="1" width="1" style="display:none" loading="lazy" alt="" src="https://www.facebook.com/tr?id=123&amp;ev=PageView&amp;noscript=1"></noscript>',
    )
    expect(await render({ pixelId: '123', enabled: true, title: '"><script>' })).toContain('title="&quot;&gt;&lt;script&gt;"')
    expect(await render({ pixelId: '123' })).toBe('<!---->')
    expect(await render({ pixelId: undefined, enabled: true })).toBe('<!---->')
  })
})
