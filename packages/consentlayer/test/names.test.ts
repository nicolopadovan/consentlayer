import { afterEach, describe, expect, it } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { configureNames, getFlag, getNames, setFlag } from '../src/core/names'
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
    expect(getNames().consentStorageKey).toBe('consentlayer_consent')
    expect(getNames().openConsentGlobalKey).toBe('CONSENTLAYER_openConsent')
    expect(getNames().autoTrackingEvents.uiClick).toBe('consentlayer.ui_click')
  })

  it('derives every name from a prefix and accepts single overrides', () => {
    configureNames({ prefix: 'shop', consentEventName: 'shop-consent' })
    expect(getNames().consentStorageKey).toBe('shop_consent')
    expect(getNames().consentGlobalKey).toBe('SHOP_CONSENT')
    expect(getNames().consentEventName).toBe('shop-consent')
  })

  it('moves a legacy stored value to the new key', () => {
    configureNames({ legacy: true })
    localStorage.setItem('acm_consent', JSON.stringify(granted))
    const storage = createLocalStorageConsentStorage({ key: 'consentlayer_consent' })
    expect(storage.read()).toEqual(granted)
    expect(localStorage.getItem('consentlayer_consent')).toBe(JSON.stringify(granted))
    expect(localStorage.getItem('acm_consent')).toBeNull()
  })

  it('leaves legacy keys alone by default', () => {
    localStorage.setItem('acm_consent', JSON.stringify(granted))
    const storage = createLocalStorageConsentStorage({ key: 'consentlayer_consent' })
    expect(storage.read()).toBeNull()
  })

  it('broadcasts under the new and legacy names', async () => {
    const seen: string[] = []
    document.addEventListener('consentlayer:consent', () => seen.push('consentlayer'))
    document.addEventListener('acm:consent', () => seen.push('acm'))
    await createAnalytics({ names: { legacy: true } }).consent.update(granted)
    expect(seen).toEqual(['consentlayer', 'acm'])
    expect(win.CONSENTLAYER_CONSENT).toEqual(granted)
    expect(win.ACM_CONSENT).toEqual(granted)
  })

  it('reads and writes window flags under both prefixes', () => {
    configureNames({ legacy: true })
    win.__acmHotjarInitialized = true
    expect(getFlag('HotjarInitialized')).toBe(true)
    setFlag('MetaPixelInitialized', true)
    expect(win.__consentlayerMetaPixelInitialized).toBe(true)
    expect(win.__acmMetaPixelInitialized).toBe(true)
  })
})
