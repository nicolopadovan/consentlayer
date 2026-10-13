import { beforeEach, describe, expect, it } from 'vitest'
import type { AnalyticsPlugin } from '../src/core/types'
import { ga4 } from '../src/providers/ga4'
import { hotjar } from '../src/providers/hotjar'
import { meta } from '../src/providers/meta'
import { shopify } from '../src/providers/shopify'
import { tiktok } from '../src/providers/tiktok'
import { vercel } from '../src/providers/vercel'
import { checkPlugin } from '../src/testing'

const plugins: Record<string, () => AnalyticsPlugin> = {
  ga4: () => ga4({ measurementId: 'G-ABC123' }),
  'ga4 without loadBeforeConsent': () => ga4({ measurementId: 'G-ABC123', loadBeforeConsent: false }),
  meta: () => meta({ pixelId: '123456789012345' }),
  'meta without loadBeforeConsent': () => meta({ pixelId: '123456789012345', loadBeforeConsent: false }),
  hotjar: () => hotjar({ siteId: 1, version: 6 }),
  shopify: () => shopify(),
  tiktok: () => tiktok(),
  vercel: () => vercel({ trackEvent: () => undefined }),
}

describe('plugin contract', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    for (const key of Object.keys(window)) {
      if (/^(__consentlayer|__acm|fbq|_fbq|gtag|dataLayer|hj|_hjSettings)/.test(key)) {
        delete (window as unknown as Record<string, unknown>)[key]
      }
    }
  })

  for (const [name, create] of Object.entries(plugins)) {
    it(`${name} passes`, async () => {
      expect(await checkPlugin(create())).toEqual([])
    })
  }

  it('reports a plugin that loads before consent', async () => {
    const leaky: AnalyticsPlugin = {
      id: 'leaky',
      requiredConsent: 'analytics',
      setup: () => {
        const script = document.createElement('script')
        script.src = 'https://example.com/x.js'
        document.head.appendChild(script)
      },
      track: () => {
        throw new Error('boom')
      },
    }
    const problems = await checkPlugin(leaky)
    expect(problems).toContain('loaded a script before consent')
    expect(problems.some((problem) => problem.startsWith('leaky.track failed'))).toBe(true)
  })
})
