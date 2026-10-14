import '@angular/compiler'
import { BrowserPlatformLocation, PlatformLocation } from '@angular/common'
import { ApplicationRef, DOCUMENT, ErrorHandler, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing'
import { provideRouter, Router } from '@angular/router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { injectConsent, injectConsentController, provideConsentLayer, provideGtmNoscript, provideMetaPixelNoscript } from '../src/angular'
import { createAnalytics } from '../src/core/create-analytics'
import type { AnalyticsPlugin } from '../src/core/types'

const spyProvider = (id: string) =>
  ({
    id,
    requiredConsent: 'analytics',
    page: vi.fn(),
    track: vi.fn(),
  }) satisfies AnalyticsPlugin

const settle = async () => {
  await TestBed.inject(ApplicationRef).whenStable()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting())
})

afterEach(() => {
  TestBed.resetTestingModule()
  localStorage.clear()
  history.replaceState(null, '', '/')
})

describe('consentlayer/angular', () => {
  it('provides the banner state as signals and records the choice', async () => {
    const analytics = createAnalytics({ providers: [] })
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideConsentLayer({ analytics })],
    })
    const controller = TestBed.runInInjectionContext(injectConsentController)
    const { consent } = TestBed.runInInjectionContext(injectConsent)
    await settle()
    expect(controller.ready()).toBe(true)
    expect(controller.bannerVisible()).toBe(true)

    await controller.acceptAll()
    expect(controller.bannerVisible()).toBe(false)
    expect(consent()).toMatchObject({ analytics: true, marketing: true })
    analytics.destroy()
  })

  it('sends a page view per navigation, after the URL and title change, without the hash', async () => {
    const ga4 = spyProvider('ga4')
    const analytics = createAnalytics({ providers: [ga4] })
    await analytics.consent.update({ analytics: true })
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PlatformLocation, useClass: BrowserPlatformLocation },
        provideRouter([
          { path: 'shop', title: 'Shop', children: [] },
          { path: '**', title: 'Home', children: [] },
        ]),
        provideConsentLayer({ analytics }),
      ],
    })
    const router = TestBed.inject(Router)
    await router.navigateByUrl('/')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(1)

    await router.navigateByUrl('/shop?page=2')
    await settle()
    expect(ga4.page).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/shop?page=2', title: 'Shop' }), expect.anything())
    await router.navigateByUrl('/shop?page=2#reviews')
    await settle()
    expect(ga4.page).toHaveBeenCalledTimes(2)
    analytics.destroy()
  })

  it('reports errors from the ErrorHandler, and not with captureErrors: false', () => {
    const analytics = createAnalytics({ providers: [] })
    const captureError = vi.spyOn(analytics, 'captureError').mockResolvedValue(undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new Error('boom')
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideConsentLayer({ analytics })],
    })
    TestBed.inject(ErrorHandler).handleError(error)
    expect(captureError).toHaveBeenCalledExactlyOnceWith(error, { source: 'boundary' })
    expect(consoleError).toHaveBeenCalledWith('ERROR', error)

    TestBed.resetTestingModule()
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideConsentLayer({ analytics, captureErrors: false })],
    })
    TestBed.inject(ErrorHandler).handleError(error)
    expect(captureError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
    analytics.destroy()
  })

  it('adds the Meta noscript pixel on the server only when enabled with an ID', () => {
    const render = (options: Parameters<typeof provideMetaPixelNoscript>[0]) => {
      TestBed.resetTestingModule()
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'server' },
          provideMetaPixelNoscript(options),
        ],
      })
      const document = TestBed.inject(DOCUMENT)
      const html = document.body.querySelector('noscript')?.innerHTML ?? null
      document.body.querySelector('noscript')?.remove()
      return html
    }
    expect(render({ pixelId: '123' })).toBeNull()
    expect(render({ pixelId: undefined, enabled: true })).toBeNull()
    expect(render({ pixelId: '123', enabled: true, loading: 'lazy' })).toContain(
      'loading="lazy" alt="" src="https://www.facebook.com/tr?id=123&amp;ev=PageView&amp;noscript=1"',
    )
  })

  it('adds the GTM noscript iframe first in the body on the server, only when enabled with an ID', () => {
    const render = (options: Parameters<typeof provideGtmNoscript>[0]) => {
      TestBed.resetTestingModule()
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: PLATFORM_ID, useValue: 'server' },
          provideGtmNoscript(options),
        ],
      })
      const document = TestBed.inject(DOCUMENT)
      const noscript = document.body.firstElementChild?.tagName === 'NOSCRIPT' ? document.body.firstElementChild : null
      noscript?.remove()
      return noscript?.innerHTML ?? null
    }
    expect(render({ containerId: 'GTM-ABC123' })).toBeNull()
    expect(render({ containerId: 'GTM-ABC123', enabled: true })).toContain(
      'src="https://www.googletagmanager.com/ns.html?id=GTM-ABC123"',
    )
  })
})
