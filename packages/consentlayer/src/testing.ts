import { createAnalyticsManager } from './core/analytics-manager'
import type { AnalyticsPlugin, ConsentState } from './core/types'

const denied: ConsentState = { preferences: false, analytics: false, marketing: false }
const granted: ConsentState = { preferences: true, analytics: true, marketing: true }

/**
 * Runs a plugin through the manager in a DOM test environment (jsdom, happy-dom)
 * and returns the contract problems found; `[]` means it passed.
 * Checks that nothing loads, sends or sets cookies before consent
 * (scripts are allowed with `loadBeforeConsent`), and that no hook throws.
 */
export async function checkPlugin(plugin: AnalyticsPlugin): Promise<string[]> {
  const problems: string[] = []
  const scripts = () => document.querySelectorAll('script[src]').length
  const before = { scripts: scripts(), cookies: document.cookie }
  const realFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = () => {
    requests += 1
    return Promise.resolve(new Response(null, { status: 204 }))
  }

  const manager = createAnalyticsManager({
    providers: [plugin],
    consent: denied,
    onError: (error) => problems.push(`${error.message}: ${String(error.cause)}`),
  })
  const exercise = async () => {
    await manager.page()
    await manager.track('sign_up', { method: 'test' })
    await manager.identify('contract_user', { email: 'contract@example.com' })
    await manager.group('contract_group')
  }
  try {
    await manager.boot()
    await exercise()
    if (plugin.requiredConsent !== 'none') {
      if (!plugin.loadBeforeConsent && scripts() > before.scripts) {
        problems.push('loaded a script before consent')
      }
      if (requests) problems.push('sent a request before consent')
      if (document.cookie !== before.cookies) problems.push('set a cookie before consent')
    }
    await manager.updateConsent(granted)
    await exercise()
    await manager.reset()
    await manager.updateConsent(denied)
  } finally {
    manager.destroy()
    globalThis.fetch = realFetch
  }
  return problems
}
