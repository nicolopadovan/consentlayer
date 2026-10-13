import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import type { AnalyticsPlugin } from '../src/core/types'
import { createEnvConfig } from '../src/core/presets'
import { AnalyticsProvider, type AnalyticsProviderProps } from '../src/react'
import { CookieBanner, CookieDialog, ManageConsentTrigger, resolveMessages } from '../src/ui'

afterEach(() => {
  localStorage.clear()
  document.documentElement.lang = ''
})

function setup(
  props: Omit<AnalyticsProviderProps, 'analytics' | 'children'> = {},
  locale?: string,
) {
  const plugin = { id: 'spy', requiredConsent: 'analytics', load: vi.fn() } satisfies AnalyticsPlugin
  const analytics = createAnalytics({ providers: [plugin], locale })
  render(
    <AnalyticsProvider analytics={analytics} {...props}>
      <CookieBanner />
      <CookieDialog />
      <ManageConsentTrigger />
    </AnalyticsProvider>,
  )
  return { analytics, plugin }
}

describe('consent UI', () => {
  it('rejecting turns every optional category off and nothing loads', async () => {
    const { analytics, plugin } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Reject non-essential' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(analytics.consent.getConsent()).toEqual({ preferences: false, analytics: false, marketing: false })
    expect(plugin.load).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Manage cookies' })).toBeTruthy()
    analytics.destroy()
  })

  it('accepting all loads the provider', async () => {
    const { analytics, plugin } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Accept all' }))
    await waitFor(() => expect(plugin.load).toHaveBeenCalledTimes(1))
    expect(analytics.consent.getConsent()).toEqual({ preferences: true, analytics: true, marketing: true })
    analytics.destroy()
  })

  it('customizes per category, and reopens from the trigger and the global', async () => {
    const { analytics, plugin } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Customize' }))
    expect(screen.getByRole('checkbox', { name: 'Necessary cookies' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Preference cookies' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Analytics cookies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }))
    await waitFor(() => expect(plugin.load).toHaveBeenCalledTimes(1))
    expect(analytics.consent.getConsent()).toEqual({ preferences: true, analytics: true, marketing: false })

    fireEvent.click(screen.getByRole('button', { name: 'Manage cookies' }))
    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => (window as unknown as { CONSENTLAYER_openConsent: () => void }).CONSENTLAYER_openConsent())
    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeTruthy()
    analytics.destroy()
  })

  it('skips the banner when consent is stored', async () => {
    const first = createAnalytics()
    await first.consent.update({ analytics: true })
    first.destroy()
    const { analytics } = setup()
    expect(await screen.findByRole('button', { name: 'Manage cookies' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull()
    analytics.destroy()
  })

  it('picks the language: provider prop, then createAnalytics, then <html lang>, then English', async () => {
    document.documentElement.lang = 'it-IT'
    const first = setup()
    expect(await screen.findByRole('button', { name: 'Accetta tutti' })).toBeTruthy()
    first.analytics.destroy()
    cleanup()

    document.documentElement.lang = 'fr'
    const second = setup({}, createEnvConfig({ NEXT_PUBLIC_ANALYTICS_LOCALE: 'it' }).locale)
    expect(await screen.findByRole('button', { name: 'Accetta tutti' })).toBeTruthy()
    second.analytics.destroy()
    cleanup()

    const third = setup({ locale: 'en' }, 'it')
    expect(await screen.findByRole('button', { name: 'Accept all' })).toBeTruthy()
    third.analytics.destroy()
    cleanup()

    const fourth = setup()
    expect(await screen.findByRole('button', { name: 'Accept all' })).toBeTruthy()
    fourth.analytics.destroy()
  })

  it('applies overrides and shows the privacy policy link', async () => {
    const { analytics } = setup({
      locale: 'it-CH',
      messages: { it: { acceptAll: 'Va bene' }, 'it-CH': { customize: 'Scegli' } },
      privacyPolicyUrl: '/privacy',
    })
    expect(await screen.findByRole('button', { name: 'Va bene' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Scegli' }))
    expect(screen.getByRole('checkbox', { name: 'Cookie statistici' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Informativa sulla privacy' })[0]?.getAttribute('href')).toBe('/privacy')
    analytics.destroy()
  })
})

describe('resolveMessages', () => {
  it('falls back to English for unknown languages and missing override keys', () => {
    expect(resolveMessages('fr').acceptAll).toBe('Accept all')
    const de = resolveMessages('de-AT', { de: { acceptAll: 'Alle akzeptieren' } })
    expect(de.acceptAll).toBe('Alle akzeptieren')
    expect(de.customize).toBe('Customize')
    expect(resolveMessages('IT').acceptAll).toBe('Accetta tutti')
  })
})
