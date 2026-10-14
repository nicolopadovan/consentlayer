import type {
  ConsentChangeSource,
  ConsentEngine,
  ConsentEngineOptions,
  ConsentEngineSnapshot,
  ConsentIntegrationAdapter,
  ConsentState,
  StoredConsent,
} from './types'
import { BUILT_IN_CATEGORIES, broadcastConsent, createDebugLog, equalConsent, normalizeConsent } from './utils'
import { assertValidConsent } from './validation'

export function createConsentEngine(options: ConsentEngineOptions = {}): ConsentEngine {
  const debugLog = createDebugLog(options.debug)
  const categories = [...BUILT_IN_CATEGORIES, ...(options.categories ?? [])]
  const normalize = (consent: Partial<ConsentState> | null | undefined) => normalizeConsent(consent, categories)
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
  const major = (version: string | undefined) => version?.split('.')[0]
  const isStaleRecord = (record: StoredConsent) =>
    (policyVersion !== undefined && major(record.policyVersion) !== major(policyVersion)) ||
    (maxAgeDays !== undefined &&
      !(typeof record.updatedAt === 'number' && Date.now() - record.updatedAt <= maxAgeDays * 86_400_000))
  let stale = false
  let changes = 0

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
    changes++
    if (persist) {
      stale = false
      storage?.write({ consent: next, updatedAt: Date.now(), policyVersion })
    }
    broadcastConsent(next, options.broadcast)
    debugLog('consent', undefined, 'consent updated', source, next)
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
    if (!adapter.observe) continue
    const observe = (consent: ConsentState | null) => {
      try {
        adapter.observe?.(consent)
      } catch (cause) {
        options.onError?.({
          scope: 'consent-adapter',
          providerId: adapter.id,
          message: `Consent adapter "${adapter.id}" failed to observe consent`,
          cause,
        })
      }
    }
    observe(current)
    listeners.add(({ consent }) => observe(consent))
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
    if (stale) debugLog('consent', undefined, 'stored consent is stale', record)
    const seen = changes
    let provisional = false
    const ask = async (adapter: ConsentIntegrationAdapter) => {
      try {
        const answer = await adapter.bootstrap?.()
        provisional = typeof answer?.consent === 'object'
        return normalize(provisional ? (answer as { consent: ConsentState }).consent : (answer as ConsentState))
      } catch (cause) {
        options.onError?.({
          scope: 'consent-adapter',
          providerId: adapter.id,
          message: `Consent adapter "${adapter.id}" failed to read consent`,
          cause,
        })
        return null
      }
    }
    const ordered = [
      ...adapters.filter((adapter) => adapter.authoritative),
      undefined,
      ...adapters.filter((adapter) => !adapter.authoritative),
    ]
    for (const adapter of ordered) {
      if (adapter && !adapter.bootstrap) continue
      const next = adapter ? await ask(adapter) : stored && (!stale || options.onStale === 'keep') ? stored : null
      if (changes !== seen) return current
      if (!next) continue
      await commit(next, 'bootstrap', {
        persist: adapter !== undefined && !provisional,
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
    gpc:
      options.gpc !== false &&
      typeof navigator !== 'undefined' &&
      (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
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
