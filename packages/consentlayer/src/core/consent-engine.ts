import type {
  ConsentChangeSource,
  ConsentEngine,
  ConsentEngineOptions,
  ConsentEngineSnapshot,
  ConsentIntegrationAdapter,
  ConsentState,
} from './types'
import {
  broadcastConsent,
  debugLog,
  equalConsent,
  normalizeConsent,
} from './utils'
import { assertValidConsent } from './validation'

export function createConsentEngine(
  options: ConsentEngineOptions = {},
): ConsentEngine {
  let current = normalizeConsent(options.initialConsent)
  const listeners = new Set<(snapshot: ConsentEngineSnapshot) => void>()
  const cleanup = new Set<() => void>()
  const adapters = options.adapters ?? []
  const storage = options.storage
  let destroyed = false
  let bootstrapping: Promise<ConsentState | null> | undefined

  const notify = () => {
    const snapshot = { consent: current }
    listeners.forEach((listener) => listener(snapshot))
  }

  const commit = async (
    next: ConsentState | null,
    source: ConsentChangeSource,
    {
      persist,
      applyAdapters,
      excludeAdapter,
    }: {
      persist: boolean
      applyAdapters: boolean
      excludeAdapter?: ConsentIntegrationAdapter
    },
  ) => {
    if (destroyed || !next || equalConsent(current, next)) return
    current = next
    if (persist) {
      storage?.write(next)
    }
    broadcastConsent(next, options.broadcast)
    debugLog(options.debug ?? false, 'consent updated', source, next)
    notify()
    if (!applyAdapters) return
    await Promise.all(
      adapters
        .filter((adapter) => adapter.apply && adapter !== excludeAdapter)
        .map(async (adapter) => {
          try {
            await adapter.apply?.(next)
          } catch (cause) {
            options.onError?.({
              scope: 'consent-adapter',
              providerId: adapter.id,
              message: `Consent adapter "${adapter.id}" failed to apply consent`,
              cause,
            })
          }
        }),
    )
  }

  if (storage?.subscribe) {
    cleanup.add(
      storage.subscribe(() => {
        const next = normalizeConsent(storage.read())
        if (next) {
          void commit(next, 'storage', { persist: false, applyAdapters: false })
        }
      }),
    )
  }

  for (const adapter of adapters) {
    if (!adapter.subscribe) continue
    const unsubscribe = adapter.subscribe((next) => {
      void commit(normalizeConsent(next), 'adapter', {
        persist: true,
        applyAdapters: true,
        excludeAdapter: adapter,
      })
    })
    if (typeof unsubscribe === 'function') {
      cleanup.add(unsubscribe)
    }
  }

  const runBootstrap = async () => {
      const stored = normalizeConsent(storage?.read() ?? null)
      if (stored) {
        await commit(stored, 'bootstrap', {
          persist: false,
          applyAdapters: false,
        })
        return current
      }

      for (const adapter of adapters) {
        if (!adapter.bootstrap) continue
        const next = normalizeConsent(await Promise.resolve(adapter.bootstrap()))
        if (!next) continue
        await commit(next, 'bootstrap', {
          persist: true,
          applyAdapters: false,
          excludeAdapter: adapter,
        })
        return current
      }

      notify()
      return current
  }

  return {
    bootstrap() {
      bootstrapping ??= runBootstrap()
      return bootstrapping
    },
    getConsent() {
      return current
    },
    async setConsent(consent, source = 'imperative') {
      assertValidConsent(consent)
      await commit(normalizeConsent(consent), source, {
        persist: true,
        applyAdapters: true,
      })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy() {
      destroyed = true
      cleanup.forEach((fn) => fn())
      cleanup.clear()
      listeners.clear()
    },
  }
}
