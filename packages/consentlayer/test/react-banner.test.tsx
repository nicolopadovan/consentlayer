import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { AnalyticsProvider } from '../src/react/analytics-provider'
import { ConsentBanner } from '../src/react/banner'

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

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
  cleanup()
  localStorage.clear()
})

describe('consentlayer/react/banner', () => {
  it('mounts the banner under AnalyticsProvider and removes it on unmount', async () => {
    const analytics = createAnalytics({ providers: [] })
    const { unmount } = render(
      <AnalyticsProvider analytics={analytics}>
        <ConsentBanner position="bottom" />
      </AnalyticsProvider>,
    )
    await settle()
    const banner = document.querySelector<HTMLElement>('.consentlayer-banner')!
    expect(banner.dataset.position).toBe('bottom')
    expect(banner.hidden).toBe(false)

    screen.getByRole('button', { name: 'Accept all' }).click()
    await settle()
    expect(analytics.consent.getConsent()).toMatchObject({ analytics: true, marketing: true })

    expect(document.querySelectorAll('.consentlayer-dialog, .consentlayer-badge')).toHaveLength(2)
    expect(document.head.querySelector('style')).not.toBeNull()

    unmount()
    expect(document.querySelector('.consentlayer-banner, .consentlayer-dialog, .consentlayer-badge')).toBeNull()
    expect(document.head.querySelector('style')).toBeNull()
    analytics.destroy()
  })

  it('throws outside AnalyticsProvider', () => {
    expect(() => render(<ConsentBanner />)).toThrow('ConsentBanner must be used within AnalyticsProvider')
  })
})
