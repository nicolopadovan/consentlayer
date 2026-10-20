import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import type { AnalyticsManagerOptions, AnalyticsPlugin, ProviderConsentRequirement } from '../src/core/types'

const denied = { preferences: false, analytics: false, marketing: false }

const spy = (id: string, requiredConsent: ProviderConsentRequirement) =>
  ({ id, requiredConsent, page: vi.fn<NonNullable<AnalyticsPlugin['page']>>() }) satisfies AnalyticsPlugin

const urls = (plugin: ReturnType<typeof spy>) => plugin.page.mock.calls.map(([page]) => page.url)

const land = async (search: string, options: Partial<AnalyticsManagerOptions> = {}) => {
  history.replaceState({}, '', `/${search}`)
  const ga4 = spy('ga4', 'analytics')
  const meta = spy('meta', 'marketing')
  const manager = createAnalyticsManager({ providers: [ga4, meta], consent: denied, ...options })
  await manager.boot()
  history.pushState({}, '', '/pricing')
  return { manager, ga4, meta }
}

afterEach(() => {
  history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('campaign', () => {
  it('adds the landing UTMs to the first page view each provider receives after a later consent', async () => {
    const { manager, ga4, meta } = await land('?utm_source=chatgpt.com&utm_medium=ai&ref=x&gclid=1')
    await manager.page()
    await manager.updateConsent({ ...denied, analytics: true })
    await manager.page()
    await manager.page()
    await manager.updateConsent({ ...denied, analytics: true, marketing: true })
    await manager.page()

    expect(urls(ga4)).toEqual([
      'http://localhost:3000/pricing?utm_source=chatgpt.com&utm_medium=ai',
      'http://localhost:3000/pricing',
      'http://localhost:3000/pricing',
    ])
    expect(ga4.page.mock.calls[0]?.[0].path).toBe('/pricing?utm_source=chatgpt.com&utm_medium=ai')
    expect(urls(meta)).toEqual(['http://localhost:3000/pricing?utm_source=chatgpt.com&utm_medium=ai'])
    manager.destroy()
  })

  it('keeps the parameters the current URL has and adds only the missing ones', async () => {
    const { manager, ga4 } = await land('?utm_source=chatgpt.com&utm_campaign=launch')
    history.pushState({}, '', '/pricing?utm_source=newsletter#plans')
    await manager.updateConsent({ ...denied, analytics: true })
    await manager.page()
    expect(urls(ga4)).toEqual(['http://localhost:3000/pricing?utm_source=newsletter&utm_campaign=launch#plans'])
    manager.destroy()
  })

  it('adds the names in params, keeps redacted parameters redacted, and does nothing with campaign: false', async () => {
    const custom = await land('?gclid=abc&utm_term=jane%40example.com&utm_content=hero', {
      campaign: { params: ['gclid'] },
      redact: { queryParams: ['utm_content'] },
    })
    await custom.manager.updateConsent({ ...denied, analytics: true })
    await custom.manager.page()
    expect(urls(custom.ga4)).toEqual([
      'http://localhost:3000/pricing?gclid=abc&utm_term=(redacted)&utm_content=(redacted)',
    ])
    custom.manager.destroy()

    const off = await land('?utm_source=chatgpt.com', { campaign: false })
    await off.manager.updateConsent({ ...denied, analytics: true })
    await off.manager.page()
    expect(urls(off.ga4)).toEqual(['http://localhost:3000/pricing'])
    off.manager.destroy()
  })

  it('adds them to the first page view forwarded to the server, and not before it is forwarded', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const forwarded = () =>
      fetchMock.mock.calls.map(([, init]) => (JSON.parse(init?.body as string) as { url: string }).url)
    const { manager } = await land('?utm_source=chatgpt.com', { server: { endpoint: '/api/analytics' } })
    await manager.page()
    await manager.updateConsent({ ...denied, analytics: true })
    await manager.page()
    await manager.page()
    expect(forwarded()).toEqual([
      'http://localhost:3000/pricing?utm_source=chatgpt.com',
      'http://localhost:3000/pricing',
    ])
    manager.destroy()
  })
})
