import type {
  ConsentChangeSource,
  ConsentEngine,
  ConsentEngineOptions,
  ConsentEngineSnapshot,
  ConsentIntegrationAdapter,
  ConsentState,
  StoredConsent,
} from './types'
import {
  BUILT_IN_CATEGORIES,
  broadcastConsent,
  debugLog,
  equalConsent,
  normalizeConsent,
} from './utils'
import { assertValidConsent } from './validation'

export function createConsentEngine(
  options: ConsentEngineOptions = {},
): ConsentEngine {
  const categories = [...BUILT_IN_CATEGORIES, ...(options.categories ?? [])]
  const normalize = (consent: Partial<ConsentState> | null | undefined) =>
    normalizeConsent(consent, categories)
  let current = normalize(options.initialConsent)
  const listeners = new Set<(snapshot: ConsentEngineSnapshot) => void>()
  const cleanup = new Set<() => void>()
  const adapters = options.adapters ?? []
  const storage = options.storage
  let destroyed = false
  let bootstrapping: Promise<ConsentState | null> | undefined
  const policyVersion = options.policyVersion?.trim() || undefined
  const { maxAgeDays } = options
  if (maxAgeDays !== undefined && !(maxAgeDays > 0 && Number.isFinite(maxAgeDays))) {
    throw new Error(`[consentlayer] consent.maxAgeDays must be a positive number, received ${maxAgeDays}`)
  }
  const isStaleRecord = (record: StoredConsent) =>
    (policyVersion !== undefined && record.policyVersion !== policyVersion) ||
    (maxAgeDays !== undefined &&
      !(typeof record.updatedAt === 'number' && Date.now() - record.updatedAt <= maxAgeDays * 86_400_000))
  let stale = false

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
    if (destroyed || !next || (equalConsent(current, next) && !(persist && stale))) return
    current = next
    if (persist) {
      stale = false
      storage?.write({ consent: next, updatedAt: Date.now(), policyVersion })
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
        const record = storage.read()
        const next = normalize(record?.consent)
        if (next && !isStaleRecord(record!)) {
          stale = false
          void commit(next, 'storage', { persist: false, applyAdapters: false })
        }
      }),
    )
  }

  for (const adapter of adapters) {
    if (!adapter.subscribe) continue
    const unsubscribe = adapter.subscribe((next) => {
      void commit(normalize({ ...current, ...next }), 'adapter', {
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
      const record = storage?.read() ?? null
      const stored = normalize(record?.consent)
      stale = stored !== null && isStaleRecord(record!)
      if (stale) debugLog(options.debug ?? false, 'stored consent is stale', record)
      if (stored && (!stale || options.onStale === 'keep')) {
        await commit(stored, 'bootstrap', {
          persist: false,
          applyAdapters: false,
        })
        return current
      }

      for (const adapter of adapters) {
        if (!adapter.bootstrap) continue
        let next: ConsentState | null
        try {
          next = normalize(await adapter.bootstrap())
        } catch (cause) {
          options.onError?.({
            scope: 'consent-adapter',
            providerId: adapter.id,
            message: `Consent adapter "${adapter.id}" failed to read consent`,
            cause,
          })
          continue
        }
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
    categories,
    bootstrap() {
      bootstrapping ??= runBootstrap()
      return bootstrapping
    },
    getConsent() {
      return current
    },
    isStale() {
      return stale
    },
    async setConsent(consent, source = 'imperative') {
      assertValidConsent(consent, categories)
      await commit(normalize(consent), source, {
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
