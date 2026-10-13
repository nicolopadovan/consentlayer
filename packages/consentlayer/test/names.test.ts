import { afterEach, describe, expect, it } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { configureNames, getFlag, setFlag, ui } from '../src/core/names'
import { defaultRuntimePreset } from '../src/core/presets'
import { createLocalStorageConsentStorage } from '../src/core/storage'
import type { ConsentState } from '../src/core/types'

const granted: ConsentState = { preferences: true, analytics: true, marketing: true }
const win = window as unknown as Record<string, unknown>

describe('names', () => {
  afterEach(() => {
    configureNames()
    localStorage.clear()
  })

  it('defaults to the consentlayer prefix', () => {
    expect(defaultRuntimePreset.consentStorageKey).toBe('consentlayer_consent')
    expect(defaultRuntimePreset.openConsentGlobalKey).toBe('CONSENTLAYER_openConsent')
    expect(defaultRuntimePreset.autoTrackingEvents.uiClick).toBe('consentlayer.ui_click')
  })

  it('derives every name from a prefix and accepts single overrides', () => {
    configureNames({ prefix: 'shop', consentEventName: 'shop-consent' })
    expect(defaultRuntimePreset.consentStorageKey).toBe('shop_consent')
    expect(defaultRuntimePreset.consentGlobalKey).toBe('SHOP_CONSENT')
    expect(defaultRuntimePreset.consentEventName).toBe('shop-consent')
    expect(ui('banner')).toBe('cl-banner acm-banner')
  })

  it('moves a legacy stored value to the new key', () => {
    localStorage.setItem('acm_consent', JSON.stringify(granted))
    const storage = createLocalStorageConsentStorage({ key: 'consentlayer_consent' })
    expect(storage.read()).toEqual(granted)
    expect(localStorage.getItem('consentlayer_consent')).toBe(JSON.stringify(granted))
    expect(localStorage.getItem('acm_consent')).toBeNull()
  })

  it('leaves legacy keys alone with legacy off', () => {
    configureNames({ legacy: false })
    localStorage.setItem('acm_consent', JSON.stringify(granted))
    const storage = createLocalStorageConsentStorage({ key: 'consentlayer_consent' })
    expect(storage.read()).toBeNull()
    expect(ui('banner')).toBe('cl-banner')
  })

  it('broadcasts under the new and legacy names', async () => {
    const seen: string[] = []
    document.addEventListener('consentlayer:consent', () => seen.push('consentlayer'))
    document.addEventListener('acm:consent', () => seen.push('acm'))
    await createAnalytics().consent.update(granted)
    expect(seen).toEqual(['consentlayer', 'acm'])
    expect(win.CONSENTLAYER_CONSENT).toEqual(granted)
    expect(win.ACM_CONSENT).toEqual(granted)
  })

  it('reads and writes window flags under both prefixes', () => {
    win.__acmHotjarInitialized = true
    expect(getFlag('HotjarInitialized')).toBe(true)
    setFlag('MetaPixelInitialized', true)
    expect(win.__consentlayerMetaPixelInitialized).toBe(true)
    expect(win.__acmMetaPixelInitialized).toBe(true)
  })
})
