import { describe, expect, it, vi } from 'vitest'
import { createAnalytics } from '../src/core/create-analytics'
import { createConsentController } from '../src/core/consent-controller'
import { createTcfAdapter } from '../src/adapters/tcf'

type Listener = (tcData: unknown, success: boolean) => void

function fakeCmp(initial: Record<string, unknown>, sync = false) {
  let tcData = initial
  const listeners = new Map<number, Listener>()
  let nextId = 0
  const tcfapi = vi.fn((command: string, version: number, callback: (...args: unknown[]) => void, parameter?: unknown) => {
    expect(version).toBe(2)
    if (command === 'addEventListener') {
      const listenerId = ++nextId
      listeners.set(listenerId, callback)
      const call = () => callback({ ...tcData, listenerId }, true)
      if (sync) call()
      else queueMicrotask(call)
    }
    if (command === 'removeEventListener') callback(listeners.delete(parameter as number))
  })
  return {
    window: { __tcfapi: tcfapi } as unknown as Window,
    tcfapi,
    listeners,
    update(next: Record<string, unknown>) {
      tcData = next
      listeners.forEach((listener, listenerId) => listener({ ...tcData, listenerId }, true))
    },
  }
}

const consents = (...granted: number[]) => Object.fromEntries(granted.map((purpose) => [purpose, true]))
const loaded = (granted: number[], eventStatus = 'tcloaded') => ({
  gdprApplies: true,
  eventStatus,
  cmpStatus: 'loaded',
  purpose: { consents: consents(...granted), legitimateInterests: consents(1, 2, 3, 4, 7, 8) },
})

describe('createTcfAdapter', () => {
  it('maps purpose consents to categories and ignores legitimate interest', async () => {
    const cmp = fakeCmp(loaded([1, 8]), true)
    const adapter = createTcfAdapter({ window: cmp.window })
    await expect(adapter.bootstrap?.()).resolves.toEqual({ preferences: true, analytics: true, marketing: false })
    expect(cmp.tcfapi).toHaveBeenCalledWith('removeEventListener', 2, expect.any(Function), 1)
    expect(cmp.listeners.size).toBe(0)

    const all = fakeCmp(loaded([1, 2, 3, 4, 7, 8]))
    await expect(createTcfAdapter({ window: all.window }).bootstrap?.()).resolves.toEqual({
      preferences: true,
      analytics: true,
      marketing: true,
    })
    const noStore = fakeCmp(loaded([2, 3, 4, 7, 8]))
    await expect(createTcfAdapter({ window: noStore.window }).bootstrap?.()).resolves.toEqual({
      preferences: false,
      analytics: false,
      marketing: false,
    })
  })

  it('takes a mapping override, which also grants custom categories', async () => {
    const cmp = fakeCmp(loaded([1, 5, 6]))
    const adapter = createTcfAdapter({
      window: cmp.window,
      purposes: { analytics: [1, 5], functional: [6] } as never,
    })
    await expect(adapter.bootstrap?.()).resolves.toEqual({
      preferences: true,
      analytics: true,
      marketing: false,
      functional: true,
    })
  })

  it('returns null without __tcfapi or when GDPR does not apply', async () => {
    expect(createTcfAdapter({ window: {} as Window }).bootstrap?.()).toBeNull()
    expect(createTcfAdapter({ window: {} as Window }).subscribe?.(vi.fn())).toBeUndefined()

    const cmp = fakeCmp({ gdprApplies: false, cmpId: 1, cmpVersion: 1, tcfPolicyVersion: 5 })
    const adapter = createTcfAdapter({ window: cmp.window })
    await expect(adapter.bootstrap?.()).resolves.toBeNull()
    const onConsent = vi.fn()
    adapter.subscribe?.(onConsent)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onConsent).not.toHaveBeenCalled()
  })

  it('reads an unanswered CMP as denied, hides the banner and takes the choice through subscribe', async () => {
    const cmp = fakeCmp(loaded([], 'cmpuishown'))
    const analytics = createAnalytics({ consent: { adapters: [createTcfAdapter({ window: cmp.window })] } })
    const controller = createConsentController(analytics, { boot: { mode: 'manual' } })
    const stop = controller.start()
    await vi.waitFor(() => expect(controller.getSnapshot().ready).toBe(true))
    expect(controller.getSnapshot().bannerVisible).toBe(false)
    expect(analytics.consent.getConsent()).toEqual({ preferences: false, analytics: false, marketing: false })

    cmp.update(loaded([1, 8], 'useractioncomplete'))
    await vi.waitFor(() =>
      expect(analytics.consent.getConsent()).toEqual({ preferences: true, analytics: true, marketing: false }),
    )
    expect(cmp.listeners.size).toBe(1)
    stop()
    analytics.destroy()
    expect(cmp.listeners.size).toBe(0)
  })

  it('removes a listener whose id arrives after unsubscribe', () => {
    const cmp = fakeCmp(loaded([1]))
    const onConsent = vi.fn()
    const unsubscribe = createTcfAdapter({ window: cmp.window }).subscribe?.(onConsent)
    expect(cmp.listeners.size).toBe(1)
    ;(unsubscribe as () => void)()
    return vi.waitFor(() => {
      expect(cmp.listeners.size).toBe(0)
      expect(onConsent).not.toHaveBeenCalled()
    })
  })
})
