import type { IdentityStorageAdapter, UserIdentity } from './types'
import { defaultRuntimePreset } from './presets'
import {
  createLocalStorageIdentityStorage,
  createMemoryIdentityStorage,
} from './storage'

let defaultIdentityStorage: IdentityStorageAdapter = createMemoryIdentityStorage()

export function setDefaultIdentityStorage(storage: IdentityStorageAdapter): void {
  defaultIdentityStorage = storage
}

export function getDefaultIdentityStorage(): IdentityStorageAdapter {
  return defaultIdentityStorage
}

export function useDefaultIdentityStorage(
  key = defaultRuntimePreset.identityStorageKey,
): IdentityStorageAdapter {
  const storage = createLocalStorageIdentityStorage({ key })
  setDefaultIdentityStorage(storage)
  return storage
}

export function saveIdentity(partial: Partial<UserIdentity>): void {
  defaultIdentityStorage.write(partial)
}

export function getIdentity(): UserIdentity {
  return defaultIdentityStorage.read()
}

export { createLocalStorageIdentityStorage, createMemoryIdentityStorage }
