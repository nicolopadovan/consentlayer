import type {
  ConsentState,
  ConsentStorageAdapter,
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

export function createLocalStorageConsentStorage(
  options: LocalStorageAdapterOptions,
): ConsentStorageAdapter {
  return {
    read() {
      const storage = getStorage(options.storage)
      if (!storage) return null
      return safeJsonParse<ConsentState>(readMigrating(storage, options))
    },
    write(consent) {
      const storage = getStorage(options.storage)
      if (!storage) return
      if (consent) {
        storage.setItem(options.key, JSON.stringify(consent))
      } else {
        storage.removeItem(options.key)
      }
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
      const storage = getStorage(options.storage)
      storage?.removeItem(options.key)
    },
  }
}

export function createLocalStorageIdentityStorage(
  options: LocalStorageAdapterOptions,
): IdentityStorageAdapter {
  return {
    read() {
      const storage = getStorage(options.storage)
      if (!storage) return {}
      return normalizeIdentity(
        safeJsonParse<UserIdentity>(readMigrating(storage, options)) ?? {},
      )
    },
    write(identity) {
      const storage = getStorage(options.storage)
      if (!storage) return
      storage.setItem(options.key, JSON.stringify(normalizeIdentity(identity)))
    },
    clear() {
      const storage = getStorage(options.storage)
      for (const key of [options.key, ...(options.legacyKeys ?? legacyStorageKeysFor(options.key))]) {
        storage?.removeItem(key)
      }
    },
  }
}

export function createMemoryConsentStorage(
  initial: ConsentState | null = null,
): ConsentStorageAdapter {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    read() {
      return value
    },
    write(consent) {
      value = consent
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

function getStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage
  if (!isBrowser()) return undefined
  return window.localStorage
}
