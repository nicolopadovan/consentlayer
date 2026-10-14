import { afterEach, describe, expect, it, vi } from 'vitest'
import { canadaRegions, ukStatisticsRegions } from '../src'
import { createConsentController } from '../src/core/consent-controller'
import { createAnalytics, type AnalyticsOptions } from '../src/core/create-analytics'
import { createConsentEngine } from '../src/core/consent-engine'
import { createMemoryConsentStorage } from '../src/core/storage'
import type { AnalyticsPlugin } from '../src/core/types'
import { readConfig } from '../src/global/config'
import { regionFromHeaders } from '../src/server'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const signal = (value: boolean | undefined) =>
  Object.defineProperty(navigator, 'globalPrivacyControl', { value, configurable: true })

afterEach(() => {
  localStorage.clear()
  signal(undefined)
})

const started = async (consent: AnalyticsOptions['consent']) => {
  const analyticsPlugin = { id: 'stats', requiredConsent: 'analytics', load: vi.fn() } satisfies AnalyticsPlugin
  const marketingPlugin = { id: 'ads', requiredConsent: 'marketing', load: vi.fn() } satisfies AnalyticsPlugin
  const analytics = createAnalytics({ providers: [analyticsPlugin, marketingPlugin], consent })
  const controller = createConsentController(analytics)
  const stop = controller.start()
  await settle()
  await settle()
  return {
    analytics,
    controller,
    loaded: () => analytics.getSnapshot().activeProviders,
    done: () => {
      stop()
      analytics.destroy()
    },
  }
}

describe('region rules', () => {
  it.each([undefined, 'DE', 'GB', 'BR', 'CA-QC', 'JP', 'XX-'])('keep opt-in for region %s', async (region) => {
    const { analytics, controller, loaded, done } = await started({ region })
    expect(analytics.consent.getConsent()).toBeNull()
    expect(controller.getSnapshot().bannerVisible).toBe(true)
    expect(loaded()).toEqual([])
    expect(analytics.consent.getRegion().rule).toEqual({})
    done()
  })

  it.each(['US-CA', 'US-TX', 'US-NY', 'US', 'us-ca'])(
    'grant every category before a choice, without a banner, in %s',
    async (region) => {
      const { analytics, controller, loaded, done } = await started({ region })
      expect(analytics.consent.getConsent()).toEqual({ preferences: true, analytics: true, marketing: true })
      expect(controller.getSnapshot().bannerVisible).toBe(false)
      expect(loaded()).toEqual(['stats', 'ads'])
      expect(localStorage.length).toBe(0)
      expect(analytics.consent.getRegion().region).toBe(region.toUpperCase())
      done()
    },
  )

  it('turn marketing off under Global Privacy Control in the US', async () => {
    signal(true)
    const { analytics, controller, loaded, done } = await started({ region: 'US-CA' })
    expect(analytics.consent.getConsent()).toEqual({ preferences: true, analytics: true, marketing: false })
    expect(controller.getSnapshot()).toMatchObject({ gpc: true, bannerVisible: false })
    expect(loaded()).toEqual(['stats'])
    done()
  })

  it('keep a stored choice over the region defaults', async () => {
    localStorage.setItem(
      'consentlayer_consent',
      JSON.stringify({ consent: { preferences: false, analytics: false, marketing: false }, updatedAt: Date.now() }),
    )
    const { analytics, loaded, done } = await started({ region: 'US-CA' })
    expect(analytics.consent.getConsent()).toEqual({ preferences: false, analytics: false, marketing: false })
    expect(loaded()).toEqual([])
    done()
  })

  it('grant analytics but ask in Switzerland, and store a choice equal to the defaults', async () => {
    const { analytics, controller, loaded, done } = await started({ region: 'CH' })
    expect(analytics.consent.getConsent()).toEqual({ preferences: true, analytics: true, marketing: false })
    expect(controller.getSnapshot()).toMatchObject({
      bannerVisible: true,
      prefs: { preferences: true, analytics: true, marketing: false },
    })
    expect(loaded()).toEqual(['stats'])
    await controller.actions.savePreferences()
    expect(controller.getSnapshot().bannerVisible).toBe(false)
    expect(analytics.consent.shouldAsk()).toBe(false)
    expect((JSON.parse(localStorage.getItem('consentlayer_consent')!) as { consent: unknown }).consent).toEqual({
      preferences: true,
      analytics: true,
      marketing: false,
    })
    done()
  })

  it('ask again after 180 days in France, shorter than maxAgeDays', async () => {
    const day = 86_400_000
    const engine = (days: number, region: string) => {
      const storage = createMemoryConsentStorage()
      storage.write({
        consent: { preferences: true, analytics: true, marketing: true },
        updatedAt: Date.now() - days * day,
      })
      return createConsentEngine({ storage, region, maxAgeDays: 365 })
    }
    const fresh = engine(170, 'FR')
    await fresh.bootstrap()
    expect(fresh.isStale()).toBe(false)
    const old = engine(190, 'FR')
    await old.bootstrap()
    expect(old.isStale()).toBe(true)
    expect(old.getConsent()).toBeNull()
    const germany = engine(190, 'DE')
    await germany.bootstrap()
    expect(germany.isStale()).toBe(false)
  })

  it('merge custom rules over the defaults', async () => {
    const regions = { ...canadaRegions, ...ukStatisticsRegions, US: {} }
    const ontario = await started({ region: 'CA-ON', regions })
    expect(ontario.analytics.consent.getConsent()).toEqual({ preferences: true, analytics: true, marketing: true })
    expect(ontario.controller.getSnapshot().bannerVisible).toBe(true)
    ontario.done()
    const quebec = await started({ region: 'CA-QC', regions })
    expect(quebec.analytics.consent.getConsent()).toBeNull()
    quebec.done()
    const uk = await started({ region: 'GB', regions })
    expect(uk.analytics.consent.getConsent()).toEqual({ preferences: false, analytics: true, marketing: false })
    expect(uk.controller.getSnapshot().bannerVisible).toBe(true)
    uk.done()
    const us = await started({ region: 'US-CA', regions })
    expect(us.analytics.consent.getConsent()).toBeNull()
    us.done()
    const swiss = await started({ region: 'CH', regions })
    expect(swiss.analytics.consent.getConsent()).toMatchObject({ analytics: true })
    swiss.done()
  })

  it('read the region from a function, and fall back to opt-in when it fails', async () => {
    const lookup = await started({ region: () => Promise.resolve('US-CA') })
    expect(lookup.analytics.consent.getConsent()).toMatchObject({ analytics: true })
    lookup.done()

    const onError = vi.fn()
    const engine = createConsentEngine({
      region: () => Promise.reject(new Error('offline')),
      onError,
    })
    expect(await engine.bootstrap()).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ scope: 'consent-region' }))
  })

  it('grant custom categories under a rule that grants all', async () => {
    const engine = createConsentEngine({ region: 'US', categories: ['functional' as never] })
    expect(await engine.bootstrap()).toEqual({
      preferences: true,
      analytics: true,
      marketing: true,
      functional: true,
    })
  })
})

describe('regionFromHeaders', () => {
  const region = (headers: Record<string, string>) => regionFromHeaders(new Headers(headers))

  it('reads the country and state Vercel, Cloudflare and CloudFront add', () => {
    expect(region({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'CA' })).toBe('US-CA')
    expect(region({ 'cf-ipcountry': 'us', 'cf-region-code': 'TX' })).toBe('US-TX')
    expect(region({ 'cf-ipcountry': 'US', 'cf-region-code': 'US-TX' })).toBe('US-TX')
    expect(region({ 'cloudfront-viewer-country': 'CA', 'cloudfront-viewer-country-region': 'QC' })).toBe('CA-QC')
    expect(region({ 'x-vercel-ip-country': 'FR' })).toBe('FR')
    expect(region({ 'x-vercel-ip-country': 'GB', 'x-vercel-ip-country-region': 'England' })).toBe('GB')
  })

  it('returns undefined for no header, Cloudflare unknown and Tor values, or junk', () => {
    expect(region({})).toBeUndefined()
    expect(region({ 'cf-ipcountry': 'XX' })).toBeUndefined()
    expect(region({ 'cf-ipcountry': 'T1' })).toBeUndefined()
    expect(region({ 'x-vercel-ip-country': '<script>' })).toBeUndefined()
  })
})

describe('script tag', () => {
  it('reads data-region', () => {
    const tag = document.createElement('script')
    tag.dataset.region = 'US-CA'
    expect(readConfig({ consent: { gpc: false } }, tag).consent).toEqual({ gpc: false, region: 'US-CA' })
  })
})
