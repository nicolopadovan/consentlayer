// @vitest-environment node
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { GtmNoscript, MetaPixelNoscript } from '../src/svelte'

describe('MetaPixelNoscript for Svelte', () => {
  it('renders the pixel only when enabled with an ID', () => {
    expect(render(MetaPixelNoscript, { props: { pixelId: '123', enabled: true, loading: 'lazy' } }).body).toMatch(
      /<noscript><img height="1" width="1" style="display:none" loading="lazy" alt="" src="https:\/\/www\.facebook\.com\/tr\?id=123&amp;ev=PageView&amp;noscript=1"[^>]*><\/noscript>/,
    )
    expect(render(MetaPixelNoscript, { props: { pixelId: '123' } }).body).not.toContain('facebook')
    expect(render(MetaPixelNoscript, { props: { pixelId: undefined, enabled: true } }).body).not.toContain('facebook')
  })
})

describe('GtmNoscript for Svelte', () => {
  it('renders the iframe only when enabled with an ID', () => {
    expect(
      render(GtmNoscript, { props: { containerId: 'GTM-ABC123', enabled: true, loading: 'lazy' } }).body,
    ).toContain('loading="lazy" src="https://www.googletagmanager.com/ns.html?id=GTM-ABC123"')
    expect(render(GtmNoscript, { props: { containerId: 'GTM-ABC123' } }).body).not.toContain('googletagmanager')
  })
})
