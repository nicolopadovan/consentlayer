import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import type { BannerOptions } from '../src/banner'
import { createAnalytics } from '../src/core/create-analytics'
import BannerApp from './svelte/BannerApp.svelte'
import UnboundBanner from './svelte/UnboundBanner.svelte'

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  flushSync()
}

const parts = () =>
  ['.consentlayer-banner', '.consentlayer-dialog', '.consentlayer-badge', 'style'].map((selector) =>
    document.querySelector(selector),
  )

const cleanups: (() => void)[] = []

const setup = async (options: BannerOptions, called = false) => {
  const analytics = createAnalytics({ providers: [] })
  const controls: { hide?: () => void; setOptions?: (options: BannerOptions) => void } = {}
  const app = mount(BannerApp, { target: document.body, props: { analytics, options, called, controls } })
  cleanups.push(() => {
    void unmount(app)
    analytics.destroy()
  })
  await settle()
  return {
    analytics,
    hide: () => {
      controls.hide!()
      flushSync()
    },
    setOptions: (next: BannerOptions) => {
      controls.setOptions!(next)
      flushSync()
    },
  }
}

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  localStorage.clear()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('consentlayer/svelte/banner', () => {
  it('mounts the banner, records the choice and removes everything on destroy', async () => {
    const app = await setup({ position: 'bottom' })

    const banner = document.querySelector<HTMLElement>('.consentlayer-banner')!
    expect(banner.dataset.position).toBe('bottom')
    expect(banner.hidden).toBe(false)
    ;[...banner.querySelectorAll('button')].find((button) => button.textContent === 'Accept all')!.click()
    await settle()
    expect(app.analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: true })

    app.hide()
    expect(parts()).toEqual([null, null, null, null])
  })

  it('re-mounts with new options', async () => {
    const app = await setup({ position: 'bottom' })

    app.setOptions({ position: 'top-right' })
    expect(document.querySelectorAll('.consentlayer-banner')).toHaveLength(1)
    expect(document.querySelector<HTMLElement>('.consentlayer-banner')!.dataset.position).toBe('top-right')
  })

  it('mounts from useConsentBanner() and unmounts with the component', async () => {
    const app = await setup({ position: 'center' }, true)
    expect(document.querySelector<HTMLElement>('.consentlayer-banner')!.dataset.position).toBe('center')

    app.hide()
    expect(parts()).toEqual([null, null, null, null])
  })

  it('throws without consentLayer()', () => {
    expect(() => {
      mount(UnboundBanner, { target: document.body })
      flushSync()
    }).toThrow('consentBanner needs consentLayer() in a parent component')
  })
})
