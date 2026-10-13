import type {
  ConsentState,
  ConsentStorageAdapter,
  StoredConsent,
  IdentityStorageAdapter,
  UserIdentity,
} from './types'
import { legacyStorageKeysFor } from './names'
import { isBrowser, normalizeIdentity, safeJsonParse } from './utils'

export type LocalStorageAdapterOptions = {
  key: string
  /** Keys to move an existing value from. Defaults to the legacy `acm_*` key when `key` is the configured one. */
  legacyKeys?: string[]
  storage?: Storage
  window?: Window
}

/** Consent in localStorage, synced across tabs. Never throws when storage is blocked or full. */
export function createLocalStorageConsentStorage(
  options: LocalStorageAdapterOptions,
): ConsentStorageAdapter {
  return {
    read() {
      return withStorage(
        options,
        (storage) => toRecord(safeJsonParse<StoredConsent | ConsentState>(readMigrating(storage, options))),
        null,
      )
    },
    write(record) {
      withStorage(
        options,
        (storage) =>
          record
            ? storage.setItem(options.key, JSON.stringify(record))
            : storage.removeItem(options.key),
        undefined,
      )
    },
    subscribe(listener) {
      const win = options.window ?? (isBrowser() ? window : undefined)
      if (!win) return () => undefined
      const handleStorage = (event: StorageEvent) => {
        if (event.key === options.key) listener()
      }
      win.addEventListener('storage', handleStorage)
      return () => win.removeEventListener('storage', handleStorage)
    },
    clear() {
      withStorage(options, (storage) => storage.removeItem(options.key), undefined)
    },
  }
}

/** Visitor identity in localStorage. Never throws when storage is blocked or full. */
export function createLocalStorageIdentityStorage(
  options: LocalStorageAdapterOptions,
): IdentityStorageAdapter {
  return {
    read() {
      return withStorage(
        options,
        (storage) =>
          normalizeIdentity(safeJsonParse<UserIdentity>(readMigrating(storage, options)) ?? {}),
        {},
      )
    },
    write(identity) {
      withStorage(
        options,
        (storage) => storage.setItem(options.key, JSON.stringify(normalizeIdentity(identity))),
        undefined,
      )
    },
    clear() {
      withStorage(
        options,
        (storage) => {
          for (const key of [options.key, ...(options.legacyKeys ?? legacyStorageKeysFor(options.key))]) {
            storage.removeItem(key)
          }
        },
        undefined,
      )
    },
  }
}

/** Consent kept in memory only, e.g. for tests or when you store it yourself. */
export function createMemoryConsentStorage(
  initial: ConsentState | null = null,
): ConsentStorageAdapter {
  let value = toRecord(initial)
  const listeners = new Set<() => void>()
  return {
    read() {
      return value
    },
    write(record) {
      value = record
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    clear() {
      value = null
      listeners.forEach((listener) => listener())
    },
  }
}

/** Identity kept in memory only. */
export function createMemoryIdentityStorage(
  initial: UserIdentity = {},
): IdentityStorageAdapter {
  let value = normalizeIdentity(initial)
  return {
    read() {
      return value
    },
    write(identity) {
      value = normalizeIdentity(identity)
    },
    clear() {
      value = {}
    },
  }
}

/** Values written before 1.0 are the bare `ConsentState`. */
function toRecord(value: StoredConsent | ConsentState | null): StoredConsent | null {
  if (!value || typeof value !== 'object') return null
  return 'consent' in value && typeof value.consent === 'object' ? value : { consent: value as ConsentState }
}

function readMigrating(
  storage: Storage,
  { key, legacyKeys = legacyStorageKeysFor(key) }: LocalStorageAdapterOptions,
): string | null {
  const value = storage.getItem(key)
  if (value !== null) return value
  for (const legacyKey of legacyKeys) {
    const legacyValue = storage.getItem(legacyKey)
    if (legacyValue === null) continue
    storage.setItem(key, legacyValue)
    storage.removeItem(legacyKey)
    return legacyValue
  }
  return null
}

/** Blocked storage (sandboxed iframes, "block all cookies") and a full quota throw; consent then lives in memory only. */
function withStorage<T>(
  options: LocalStorageAdapterOptions,
  run: (storage: Storage) => T,
  fallback: T,
): T {
  try {
    const storage = options.storage ?? (isBrowser() ? window.localStorage : undefined)
    return storage ? run(storage) : fallback
  } catch {
    return fallback
  }
}
