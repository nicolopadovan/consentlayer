import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsManager } from '../src/core/analytics-manager'
import { definePlugin } from '../src/core/plugin'
import { createMemoryIdentityStorage } from '../src/core/storage'
import type { AnalyticsError } from '../src/core/types'
import { normalizeIdentity } from '../src/core/utils'
import {
  assertHttpsOrRelativeUrl,
  assertValidGa4MeasurementId,
  assertValidMetaPixelId,
  isValidEmail,
  isValidPhoneE164,
} from '../src/core/validation'
import { ga4 } from '../src/providers/ga4'
import { meta } from '../src/providers/meta'

describe('validation helpers', () => {
  it('accepts well-formed GA4 measurement ids and rejects bad ones', () => {
    expect(assertValidGa4MeasurementId('G-ABC1234')).toBe('G-ABC1234')
    expect(() => assertValidGa4MeasurementId('UA-12345')).toThrow(/GA4 measurement ID/)
    expect(() => assertValidGa4MeasurementId('')).toThrow(/GA4 measurement ID/)
    expect(() => assertValidGa4MeasurementId(undefined)).toThrow(/GA4 measurement ID/)
  })

  it('accepts numeric Meta pixel ids and rejects bad ones', () => {
    expect(assertValidMetaPixelId('123456789012345')).toBe('123456789012345')
    expect(() => assertValidMetaPixelId('pixel-123')).toThrow(/Meta Pixel ID/)
    expect(() => assertValidMetaPixelId('123')).toThrow(/Meta Pixel ID/)
  })

  it('accepts https URLs and relative paths, rejects http/javascript', () => {
    expect(assertHttpsOrRelativeUrl('https://api.example.com/track', 'endpoint')).toBe('https://api.example.com/track')
    expect(assertHttpsOrRelativeUrl('/api/track', 'endpoint')).toBe('/api/track')
    expect(() => assertHttpsOrRelativeUrl('http://insecure.example.com', 'endpoint')).toThrow(/endpoint/)
    expect(() => assertHttpsOrRelativeUrl('javascript:alert(1)', 'endpoint')).toThrow(/endpoint/)
  })

  it('validates emails and phones', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('user@@example.com')).toBe(false)
    expect(isValidEmail('user@mail.example.co.uk')).toBe(true)
    const start = performance.now()
    expect(isValidEmail(`a@${'.'.repeat(50_000)}`)).toBe(false)
    expect(performance.now() - start).toBeLessThan(100)

    expect(isValidPhoneE164('+393331234567')).toBe(true)
    expect(isValidPhoneE164('+1234567890')).toBe(true)
    expect(isValidPhoneE164('not-a-phone')).toBe(false)
    expect(isValidPhoneE164('0123456')).toBe(false)
  })
})

describe('normalizeIdentity', () => {
  it('keeps valid email/phone and drops invalid values silently', () => {
    expect(normalizeIdentity({ email: 'User@Example.com', phone: '+39 333 123 4567' })).toEqual({
      email: 'user@example.com',
      phone: '+393331234567',
    })

    expect(normalizeIdentity({ email: 'not-an-email', phone: 'abc' })).toEqual({})

    expect(normalizeIdentity({ userId: 'user-1' })).toEqual({
      userId: 'user-1',
    })
  })
})

describe('adapter construction', () => {
  it('throws at construction when GA4 measurement id is invalid', () => {
    expect(() => ga4({ measurementId: 'oops' })).toThrow(/GA4 measurement ID/)
  })

  it('throws at construction when Meta pixel id or the server endpoint is invalid', () => {
    expect(() => meta({ pixelId: 'oops' })).toThrow(/Meta Pixel ID/)
    expect(() => createAnalyticsManager({ server: { endpoint: 'http://insecure.example.com' } })).toThrow(
      /server\.endpoint/,
    )
  })
})

describe('definePlugin', () => {
  it('requires every plugin to name the consent it needs', () => {
    // @ts-expect-error requiredConsent has no default
    expect(definePlugin({ id: 'implicit' }).id).toBe('implicit')
    expect(definePlugin({ id: 'explicit', requiredConsent: 'none' }).requiredConsent).toBe('none')
  })

  it('never loads a plain-JS plugin that omits requiredConsent', async () => {
    const load = vi.fn()
    const manager = createAnalyticsManager({
      // @ts-expect-error requiredConsent is missing
      providers: [{ id: 'implicit', load }],
      identityStorage: createMemoryIdentityStorage(),
    })
    await manager.boot()
    await manager.updateConsent({ preferences: true, analytics: true, marketing: true })
    expect(load).not.toHaveBeenCalled()
  })
})

describe('onError plumbing', () => {
  it('routes provider lifecycle errors to onError with provider id and scope', async () => {
    const onError = vi.fn<(error: AnalyticsError) => void>()
    const provider = {
      id: 'broken',
      requiredConsent: 'none' as const,
      load: () => {
        throw new Error('boom')
      },
    }

    const manager = createAnalyticsManager({
      providers: [provider],
      identityStorage: createMemoryIdentityStorage(),
      onError,
    })

    await manager.boot()
    await manager.updateConsent({
      preferences: true,
      analytics: true,
      marketing: true,
    })

    expect(onError).toHaveBeenCalled()
    const errorArg = onError.mock.calls[0]?.[0]
    expect(errorArg?.providerId).toBe('broken')
    expect(errorArg?.scope).toBe('provider-load')
    expect((errorArg?.cause as Error).message).toBe('boom')
  })

  it('exposes emitError on the provider context so adapters can report async errors', async () => {
    const onError = vi.fn()
    const provider = {
      id: 'async-loader',
      requiredConsent: 'none' as const,
      setup: (context: { emitError: (e: { scope: 'provider-script-load'; message: string }) => void }) => {
        context.emitError({
          scope: 'provider-script-load',
          message: 'cdn unreachable',
        })
      },
    }

    const manager = createAnalyticsManager({
      providers: [provider],
      identityStorage: createMemoryIdentityStorage(),
      onError,
    })

    await manager.boot()

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'provider-script-load',
        providerId: 'async-loader',
        message: 'cdn unreachable',
      }),
    )
  })
})
