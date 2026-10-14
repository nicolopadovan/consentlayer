import type {
  ConsentBroadcastConfig,
  ConsentCategory,
  ConsentState,
  DebugOptions,
  DebugTopic,
  ProviderConsentRequirement,
  UserIdentity,
} from './types'
import { isValidEmail, isValidPhoneE164 } from './validation'

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export function noop(): void {}

export const BUILT_IN_CATEGORIES = ['preferences', 'analytics', 'marketing'] as const

export function normalizeConsent(
  consent: Partial<ConsentState> | null | undefined,
  categories: readonly ConsentCategory[] = BUILT_IN_CATEGORIES,
): ConsentState | null {
  if (!consent) return null
  return {
    ...(Object.fromEntries(
      categories.map((category) => [category, Boolean(consent[category])]),
    ) as Record<ConsentCategory, boolean>),
    ...(typeof consent.sale_of_data === 'boolean'
      ? { sale_of_data: consent.sale_of_data }
      : {}),
  }
}

export function equalConsent(
  left: ConsentState | null,
  right: ConsentState | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function hasRequiredConsent(
  consent: ConsentState | null,
  required?: ProviderConsentRequirement,
): boolean {
  if (!required || required === 'none') return true
  if (!consent) return false
  if (typeof required === 'function') return required(consent)
  return Boolean(consent[required])
}

export function normalizeIdentity(identity: Partial<UserIdentity>): UserIdentity {
  const output: UserIdentity = {}
  if (identity.email) {
    const candidate = identity.email.trim().toLowerCase()
    if (isValidEmail(candidate)) output.email = candidate
  }
  if (identity.phone) {
    const candidate = identity.phone.replace(/[\s\-().]/g, '')
    if (isValidPhoneE164(candidate)) output.phone = candidate
  }
  const userId = identity.userId ?? (identity as { external_id?: string }).external_id
  if (userId) output.userId = String(userId)
  return output
}

export function createEventId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  } catch {
    return Math.random().toString(36).slice(2)
  }
}

/** Expires matching cookies on this host and every parent domain, wherever the vendor set them. */
export function expireCookies(match: (name: string) => boolean): void {
  const hosts = location.hostname.split('.').map((_, i, parts) => parts.slice(i).join('.'))
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (!name || !match(name)) continue
    for (const domain of ['', ...hosts.map((host) => `; domain=${host}`)]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
    }
  }
}

export function getWindowLocation(): { url?: string; path?: string; title?: string } {
  if (!isBrowser()) return {}
  return {
    url: window.location.href,
    path: window.location.pathname + window.location.search,
    title: document.title,
  }
}

export function sanitizeVercelPayload(
  params: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value == null) sanitized[key] = null
    else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString()
    }
  }
  return sanitized
}

export function broadcastConsent(
  consent: ConsentState,
  config: ConsentBroadcastConfig = {},
): void {
  const doc = config.document ?? (typeof document !== 'undefined' ? document : undefined)
  const win = config.window ?? (typeof window !== 'undefined' ? window : undefined)
  if (win) {
    for (const key of [config.globalKey ?? []].flat()) {
      ;(win as unknown as Record<string, unknown>)[key] = consent
    }
  }
  if (doc) {
    for (const name of [config.eventName ?? []].flat()) {
      doc.dispatchEvent(new CustomEvent(name, { detail: consent }))
    }
  }
}

const DEBUG_TOPICS: DebugTopic[] = ['consent', 'events', 'providers', 'errors']

export type DebugLog = (topic: DebugTopic, provider: string | undefined, message: string, ...data: unknown[]) => void

export function createDebugLog(debug: boolean | DebugOptions | undefined): DebugLog {
  if (!debug) return () => undefined
  const options = debug === true ? {} : debug
  const anyOn = DEBUG_TOPICS.some((topic) => options[topic])
  return (topic, provider, message, ...data) => {
    if (!(options[topic] ?? !anyOn)) return
    if (provider && options.only && !options.only.includes(provider)) return
    if (options.logger) options.logger({ topic, provider, message, data })
    else console.debug('[consentlayer]', message, ...data)
  }
}

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
