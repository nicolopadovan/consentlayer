/** Event names used by auto-tracking. */
export type AutoTrackingEventNames = {
  pageSessionStart: string
  scrollDepth: string
  timeOnPage: string
  uiClick: string
}

/** Storage keys, globals and DOM events in use. */
export type Names = {
  prefix: string
  legacy: boolean
  consentStorageKey: string
  identityStorageKey: string
  consentEventName: string
  consentGlobalKey: string
  openConsentGlobalKey: string
  autoTrackingEvents: AutoTrackingEventNames
}

/** Overrides for `createAnalytics({ names })`; the rest derives from `prefix`. */
export type NamesInput = Partial<Omit<Names, 'autoTrackingEvents'>> & {
  autoTrackingEvents?: Partial<AutoTrackingEventNames>
}

export const DEFAULT_PREFIX = 'consentlayer'

function derive(prefix: string, legacy: boolean): Names {
  const upper = prefix.toUpperCase()
  return {
    prefix,
    legacy,
    consentStorageKey: `${prefix}_consent`,
    identityStorageKey: `${prefix}_user_identity`,
    consentEventName: `${prefix}:consent`,
    consentGlobalKey: `${upper}_CONSENT`,
    openConsentGlobalKey: `${upper}_openConsent`,
    autoTrackingEvents: {
      pageSessionStart: `${prefix}.page_session_start`,
      scrollDepth: `${prefix}.scroll_depth`,
      timeOnPage: `${prefix}.time_on_page`,
      uiClick: `${prefix}.ui_click`,
    },
  }
}

/** Names used before 1.0.0-rc.2. Read and written too when `legacy` is on. */
export const legacyNames: Names = derive('acm', false)

let current = derive(DEFAULT_PREFIX, false)

/**
 * Sets every storage key, global, DOM event and auto-tracking event name the
 * package uses. Each call starts again from the defaults.
 * Call it before the first read of consent, e.g. at the top of the module
 * that sets up analytics.
 */
export function configureNames(input: NamesInput = {}): Names {
  const base = derive(input.prefix ?? DEFAULT_PREFIX, input.legacy ?? false)
  const overrides = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
  current = {
    ...base,
    ...overrides,
    autoTrackingEvents: {
      ...base.autoTrackingEvents,
      ...input.autoTrackingEvents,
    },
  }
  return current
}

/** The names in use, after `createAnalytics({ names })`. */
export function getNames(): Names {
  return current
}

/** Old keys to migrate into `key` from, if `key` is one of the package's own. */
export function legacyStorageKeysFor(key: string): string[] {
  if (!current.legacy) return []
  if (key === current.consentStorageKey && key !== legacyNames.consentStorageKey) {
    return [legacyNames.consentStorageKey]
  }
  if (key === current.identityStorageKey && key !== legacyNames.identityStorageKey) {
    return [legacyNames.identityStorageKey]
  }
  return []
}

/** The configured name, plus the legacy one while `legacy` is on. */
export function withLegacy(pick: (names: Names) => string): string[] {
  const name = pick(current)
  const old = pick(legacyNames)
  return current.legacy && old !== name ? [name, old] : [name]
}

type FlagWindow = Record<string, unknown>

/** Window flags providers use to avoid loading a script twice. */
export function getFlag<T>(name: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  const win = window as unknown as FlagWindow
  return (win[`__${current.prefix}${name}`] ?? (current.legacy ? win[`__${legacyNames.prefix}${name}`] : undefined)) as
    | T
    | undefined
}

/** Sets a `window.__<prefix><name>` flag, so custom plugins can mark one-time setup. */
export function setFlag<T>(name: string, value: T): T {
  if (typeof window === 'undefined') return value
  const win = window as unknown as FlagWindow
  win[`__${current.prefix}${name}`] = value
  if (current.legacy) win[`__${legacyNames.prefix}${name}`] = value
  return value
}
