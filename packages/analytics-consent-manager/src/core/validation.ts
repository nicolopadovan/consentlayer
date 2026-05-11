const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{4,16}$/
const META_PIXEL_ID = /^\d{8,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_E164 = /^\+?[1-9]\d{6,14}$/

export function isValidGa4MeasurementId(value: unknown): value is string {
  return typeof value === 'string' && GA4_MEASUREMENT_ID.test(value)
}

export function assertValidGa4MeasurementId(value: unknown): string {
  if (!isValidGa4MeasurementId(value)) {
    throw new Error(
      `[analytics-consent-manager] Invalid GA4 measurement ID: expected format "G-XXXXXXXX", received ${describe(value)}.`,
    )
  }
  return value
}

export function isValidMetaPixelId(value: unknown): value is string {
  return typeof value === 'string' && META_PIXEL_ID.test(value)
}

export function assertValidMetaPixelId(value: unknown): string {
  if (!isValidMetaPixelId(value)) {
    throw new Error(
      `[analytics-consent-manager] Invalid Meta Pixel ID: expected 8-20 digit numeric string, received ${describe(value)}.`,
    )
  }
  return value
}

export function isHttpsOrRelativeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.startsWith('/')) return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function assertHttpsOrRelativeUrl(value: unknown, label: string): string {
  if (!isHttpsOrRelativeUrl(value)) {
    throw new Error(
      `[analytics-consent-manager] ${label} must be an HTTPS URL or a relative path starting with "/", received ${describe(value)}.`,
    )
  }
  return value
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL.test(value)
}

export function isValidPhoneE164(value: unknown): value is string {
  return typeof value === 'string' && PHONE_E164.test(value)
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value.length > 32 ? `string(length=${value.length})` : `"${value}"`
  return typeof value
}
