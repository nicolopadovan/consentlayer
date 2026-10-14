import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { readConfig } from '../src/global/config'
import { meta } from '../src/providers/meta'

describe('nonce', () => {
  it('is set on the inline and external scripts a provider injects, once consent allows them', async () => {
    const inline: HTMLScriptElement[] = []
    const append = document.head.appendChild.bind(document.head)
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement && !node.src) inline.push(node)
      return append(node)
    })
    const manager = createAnalyticsManager({
      providers: [meta({ pixelId: '1234567890' })],
      consent: null,
      nonce: 'r4nd0m',
    })
    await manager.boot()
    expect(document.scripts).toHaveLength(0)
    expect(inline).toHaveLength(0)

    await manager.updateConsent({ preferences: false, analytics: false, marketing: true })
    const external = document.querySelector<HTMLScriptElement>('script[src*="fbevents.js"]')
    expect(external?.nonce).toBe('r4nd0m')
    expect(inline.map((script) => [script.dataset.consentlayer, script.nonce])).toEqual([
      ['meta-pixel-bootstrap', 'r4nd0m'],
    ])
  })

  it('is read from the script tag by the script-tag build', () => {
    const script = document.createElement('script')
    script.nonce = 'tag-nonce'
    expect(readConfig(undefined, script).nonce).toBe('tag-nonce')
    expect(readConfig({ nonce: 'set' }, script).nonce).toBe('set')
  })
})
