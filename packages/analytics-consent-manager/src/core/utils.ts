import type {
  AnalyticsProviderContext,
  ConsentBroadcastConfig,
  ConsentState,
  ProviderConsentRequirement,
  UserIdentity,
} from './types'
import { isValidEmail, isValidPhoneE164 } from './validation'

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export function noop(): void {}

export function normalizeConsent(
  consent: Partial<ConsentState> | null | undefined,
): ConsentState | null {
  if (!consent) return null
  return {
    preferences: Boolean(consent.preferences),
    analytics: Boolean(consent.analytics),
    marketing: Boolean(consent.marketing),
    ...(typeof consent.sale_of_data === 'boolean'
      ? { sale_of_data: consent.sale_of_data }
      : {}),
  }
}

export function equalConsent(
  left: ConsentState | null,
  right: ConsentState | null,
): boolean {
  return JSON.stringify(normalizeConsent(left)) === JSON.stringify(normalizeConsent(right))
}

export function hasRequiredConsent(
  consent: ConsentState | null,
  required?: ProviderConsentRequirement,
): boolean {
  if (!required) return true
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

/**
 * `enabled()` for a provider that must not run at all before `category` is
 * granted. Stays true afterwards so a withdrawal still reaches the provider.
 */
export function consentLatch(
  category: keyof ConsentState,
): (context: AnalyticsProviderContext) => boolean {
  let granted = false
  return (context) => (granted ||= context.consent?.[category] === true)
}

export function debugLog(enabled: boolean, ...parts: unknown[]): void {
  if (enabled) {
    console.debug('[analytics-consent-manager]', ...parts)
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
