import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/demo',
  useSearchParams: () => new URLSearchParams('ref=integration'),
}))

type IdleWindow = Window & {
  requestIdleCallback: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
  cancelIdleCallback: (handle: number) => void
}

describe('AnalyticsShell', () => {
  let requestIdleCallbackMock: ReturnType<
    typeof vi.fn<(callback: IdleRequestCallback) => number>
  >

  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    document.body.innerHTML = ''
    Object.assign(process.env, {
      NEXT_PUBLIC_ENABLE_ANALYTICS: 'true',
      NEXT_PUBLIC_ANALYTICS_DEBUG: 'false',
      NEXT_PUBLIC_FACEBOOK_PIXEL_ID: '',
      NEXT_PUBLIC_HOTJAR_SITE_ID: '',
      NEXT_PUBLIC_HOTJAR_VERSION: '',
      NEXT_PUBLIC_SHOPIFY_STORE_ID: '',
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: '',
    })
    requestIdleCallbackMock = vi.fn((callback: IdleRequestCallback) => {
      callback({
        didTimeout: false,
        timeRemaining: () => 10,
      } as IdleDeadline)
      return 1
    })
    const idleWindow = window as IdleWindow
    idleWindow.requestIdleCallback = requestIdleCallbackMock
    idleWindow.cancelIdleCallback = vi.fn()
  })

  it('boots lazily, wires children into consent context, and registers Meta in the client runtime', async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_FACEBOOK_PIXEL_ID: '1959498944961766',
    })
    const { createEnvConfig } = await import(
      '@nicolopadovan/analytics-consent-manager'
    )
    const { useConsent } = await import(
      '@nicolopadovan/analytics-consent-manager/react'
    )
    const { AnalyticsShell } = await import('./analytics-shell')

    function ConsentProbe() {
      const { consent } = useConsent()
      return <pre data-testid="consent-probe">{JSON.stringify(consent)}</pre>
    }

    render(
      <AnalyticsShell env={createEnvConfig(process.env)}>
        <ConsentProbe />
      </AnalyticsShell>,
    )

    await waitFor(() => expect(screen.getByText('Cookie preferences')).toBeTruthy())
    expect(requestIdleCallbackMock).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Accept all'))

    await waitFor(() =>
      expect(screen.queryByText('Cookie preferences')).toBeNull(),
    )
    expect(localStorage.getItem('acm_consent')).toContain('"marketing":true')
    expect(screen.getByText('Manage cookies')).toBeTruthy()
    expect(screen.getByTestId('consent-probe').textContent).toContain(
      '"marketing":true',
    )
    expect(
      document.head.querySelector(
        'script[data-analytics-consent-manager="meta-pixel"]',
      ),
    ).toBeTruthy()
  })
})
