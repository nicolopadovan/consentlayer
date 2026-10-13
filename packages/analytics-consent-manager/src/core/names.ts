export type AutoTrackingEventNames = {
  pageSessionStart: string
  scrollDepth: string
  timeOnPage: string
  uiClick: string
}

export type Names = {
  prefix: string
  classPrefix: string
  legacy: boolean
  consentStorageKey: string
  identityStorageKey: string
  consentEventName: string
  consentGlobalKey: string
  openConsentGlobalKey: string
  autoTrackingEvents: AutoTrackingEventNames
}

export type NamesInput = Partial<Omit<Names, 'autoTrackingEvents'>> & {
  autoTrackingEvents?: Partial<AutoTrackingEventNames>
}

export const DEFAULT_PREFIX = 'npcm'

function derive(prefix: string, classPrefix: string, legacy: boolean): Names {
  const upper = prefix.toUpperCase()
  return {
    prefix,
    classPrefix,
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

/** Names used before 1.0.0-rc.2. Still read and written while `legacy` is on. */
export const legacyNames: Names = derive('acm', 'acm', false)

let current = derive(DEFAULT_PREFIX, DEFAULT_PREFIX, true)

/**
 * Sets every storage key, global, DOM event, auto-tracking event name and CSS
 * class prefix the package uses. Each call starts again from the defaults.
 * Call it before the first read of consent, e.g. at the top of the module
 * that sets up analytics.
 */
export function configureNames(input: NamesInput = {}): Names {
  const base = derive(
    input.prefix ?? DEFAULT_PREFIX,
    input.classPrefix ?? DEFAULT_PREFIX,
    input.legacy ?? true,
  )
  const overrides = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  )
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
export function withLegacy(
  pick: (names: Names) => string,
): string[] {
  const name = pick(current)
  const old = pick(legacyNames)
  return current.legacy && old !== name ? [name, old] : [name]
}

type FlagWindow = Record<string, unknown>

/** Window flags providers use to avoid loading a script twice. */
export function getFlag<T>(name: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  const win = window as unknown as FlagWindow
  return (win[`__${current.prefix}${name}`] ??
    (current.legacy ? win[`__${legacyNames.prefix}${name}`] : undefined)) as
    | T
    | undefined
}

export function setFlag<T>(name: string, value: T): T {
  if (typeof window === 'undefined') return value
  const win = window as unknown as FlagWindow
  win[`__${current.prefix}${name}`] = value
  if (current.legacy) win[`__${legacyNames.prefix}${name}`] = value
  return value
}

/** `ui('banner__button')` → `"npcm-banner__button acm-banner__button"`. */
export function ui(...blocks: string[]): string {
  return blocks
    .flatMap((block) =>
      withLegacy((names) => `${names.classPrefix}-${block}`),
    )
    .join(' ')
}
