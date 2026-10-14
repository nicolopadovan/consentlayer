import { createComponent, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, describe, expect, it } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { AnalyticsProvider } from '../src/solid'
import { ConsentBanner } from '../src/solid/banner'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  localStorage.clear()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('consentlayer/solid/banner', () => {
  it('mounts the banner, records the choice, follows its props and unmounts', async () => {
    const analytics = createAnalytics({ providers: [] })
    const [position, setPosition] = createSignal<'bottom' | 'top'>('bottom')
    const dispose = render(
      () =>
        createComponent(AnalyticsProvider, {
          analytics,
          get children() {
            return createComponent(ConsentBanner, {
              get position() {
                return position()
              },
            })
          },
        }),
      document.body,
    )
    await settle()

    const banner = document.querySelector<HTMLElement>('.consentlayer-banner')!
    expect(banner.dataset.position).toBe('bottom')
    expect(banner.hidden).toBe(false)

    setPosition('top')
    await settle()
    expect(document.querySelectorAll('.consentlayer-banner')).toHaveLength(1)
    expect(document.querySelector<HTMLElement>('.consentlayer-banner')!.dataset.position).toBe('top')

    const accept = [...document.querySelectorAll<HTMLButtonElement>('.consentlayer-banner button')].find(
      (button) => button.textContent === 'Accept all',
    )!
    accept.click()
    await settle()
    expect(analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: true })

    dispose()
    expect(document.querySelector('.consentlayer-banner, .consentlayer-dialog, .consentlayer-badge')).toBeNull()
    expect(document.head.querySelector('style')).toBeNull()
    analytics.destroy()
  })

  it('throws outside AnalyticsProvider', () => {
    expect(() => render(() => createComponent(ConsentBanner, {}), document.body)).toThrow(
      'ConsentBanner must be used within AnalyticsProvider',
    )
  })
})
