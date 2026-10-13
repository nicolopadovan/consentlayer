import { afterEach, describe, expect, it } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { configureNames, getFlag, setFlag, ui } from '../src/core/names'
import { defaultRuntimePreset } from '../src/core/presets'
import { createLocalStorageConsentStorage } from '../src/core/storage'
import type { AnalyticsProviderContext, ConsentState } from '../src/core/types'
import { createGa4Adapter } from '../src/providers/ga4'

const granted: ConsentState = { preferences: true, analytics: true, marketing: true }
const denied: ConsentState = { preferences: false, analytics: false, marketing: false }
const win = window as unknown as Record<string, unknown>

describe('names', () => {
  afterEach(() => {
    configureNames()
    localStorage.clear()
  })

  it('defaults to the npcm prefix', () => {
    expect(defaultRuntimePreset.consentStorageKey).toBe('npcm_consent')
    expect(defaultRuntimePreset.openConsentGlobalKey).toBe('NPCM_openConsent')
    expect(defaultRuntimePreset.autoTrackingEvents.uiClick).toBe('npcm.ui_click')
  })

  it('derives every name from a prefix and accepts single overrides', () => {
    configureNames({ prefix: 'shop', consentEventName: 'shop-consent' })
    expect(defaultRuntimePreset.consentStorageKey).toBe('shop_consent')
    expect(defaultRuntimePreset.consentGlobalKey).toBe('SHOP_CONSENT')
    expect(defaultRuntimePreset.consentEventName).toBe('shop-consent')
    expect(ui('banner')).toBe('npcm-banner acm-banner')
  })

  it('moves a legacy stored value to the new key', () => {
    localStorage.setItem('acm_consent', JSON.stringify(granted))
    const storage = createLocalStorageConsentStorage({ key: 'npcm_consent' })
    expect(storage.read()).toEqual(granted)
    expect(localStorage.getItem('npcm_consent')).toBe(JSON.stringify(granted))
    expect(localStorage.getItem('acm_consent')).toBeNull()
  })

  it('leaves legacy keys alone with legacy off', () => {
    configureNames({ legacy: false })
    localStorage.setItem('acm_consent', JSON.stringify(granted))
    const storage = createLocalStorageConsentStorage({ key: 'npcm_consent' })
    expect(storage.read()).toBeNull()
    expect(ui('banner')).toBe('npcm-banner')
  })

  it('broadcasts under the new and legacy names', async () => {
    const seen: string[] = []
    document.addEventListener('npcm:consent', () => seen.push('npcm'))
    document.addEventListener('acm:consent', () => seen.push('acm'))
    await createAnalytics().consent.update(granted)
    expect(seen).toEqual(['npcm', 'acm'])
    expect(win.NPCM_CONSENT).toEqual(granted)
    expect(win.ACM_CONSENT).toEqual(granted)
  })

  it('reads and writes window flags under both prefixes', () => {
    win.__acmHotjarInitialized = true
    expect(getFlag('HotjarInitialized')).toBe(true)
    setFlag('MetaPixelInitialized', true)
    expect(win.__npcmMetaPixelInitialized).toBe(true)
    expect(win.__acmMetaPixelInitialized).toBe(true)
  })
})

describe('loadBeforeConsent', () => {
  const context = (consent: ConsentState) =>
    ({ consent }) as unknown as AnalyticsProviderContext

  it('keeps the provider enabled by default', () => {
    const adapter = createGa4Adapter({ measurementId: 'G-ABC123' })
    expect(adapter.enabled?.(context(denied)) ?? true).toBe(true)
  })

  it('stays disabled until consent, then stays enabled', () => {
    const adapter = createGa4Adapter({
      measurementId: 'G-ABC123',
      loadBeforeConsent: false,
    })
    expect(adapter.enabled?.(context(denied))).toBe(false)
    expect(adapter.enabled?.(context(granted))).toBe(true)
    expect(adapter.enabled?.(context(denied))).toBe(true)
  })
})
