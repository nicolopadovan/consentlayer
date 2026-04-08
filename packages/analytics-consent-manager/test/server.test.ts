// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  ANALYTICS_MAX_BODY,
  assertSameOrigin,
  createGa4CollectUrl,
  createGa4MeasurementPayload,
  createMetaEventPayload,
  parseJsonWithLimit,
  sanitizeMetaCustomData,
  sha256,
} from '../src/server'

describe('server helpers', () => {
  it('validates same-origin headers', () => {
    const allowed = new Request('https://example.com/test', {
      headers: { origin: 'https://example.com' },
    })
    expect(() => assertSameOrigin(allowed, { requireHeader: true })).not.toThrow()

    const blocked = new Request('https://example.com/test', {
      headers: { origin: 'https://evil.com' },
    })
    expect(() => assertSameOrigin(blocked, { requireHeader: true })).toThrow(
      /cross-origin/,
    )
  })

  it('parses bounded JSON bodies', async () => {
    const request = new Request('https://example.com/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    })
    await expect(parseJsonWithLimit<{ ok: boolean }>(request, ANALYTICS_MAX_BODY)).resolves.toEqual({
      ok: true,
    })

    const oversized = new Request('https://example.com/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blob: 'x'.repeat(32) }),
    })
    await expect(parseJsonWithLimit(oversized, 8)).rejects.toThrow(
      /Payload Too Large/,
    )
  })

  it('shapes and sanitizes Meta payloads', () => {
    const payload = createMetaEventPayload({
      eventName: 'Purchase',
      eventId: 'evt-1',
      eventSourceUrl: 'https://example.com',
      customData: {
        valid: true,
        nested: { ok: true },
        invalid: () => undefined,
      },
      user: {
        email: 'Demo@Example.com',
        phone: '+39 333 123 4567',
        external_id: 'user-1',
      },
      cookieHeader: '_fbp=fbp123; _fbc=fbc123',
    })

    expect(payload.data[0].event_id).toBe('evt-1')
    expect(payload.data[0].custom_data).toEqual({
      valid: true,
      nested: { ok: true },
      currency: 'EUR',
    })
    expect(payload.data[0].user_data.em).toBe(sha256('demo@example.com'))
    expect(payload.data[0].user_data.fbp).toBe('fbp123')
  })

  it('builds GA4 measurement payloads and urls', () => {
    expect(
      createGa4MeasurementPayload({
        clientId: 'client-1',
        userId: 'user-1',
        eventName: 'purchase',
        params: { value: 42 },
      }),
    ).toEqual({
      client_id: 'client-1',
      user_id: 'user-1',
      events: [{ name: 'purchase', params: { value: 42 } }],
    })

    expect(
      createGa4CollectUrl({
        measurementId: 'G-123',
        apiSecret: 'secret',
      }),
    ).toContain('measurement_id=G-123')
    expect(sanitizeMetaCustomData({ value: 99 }, { currency: 'EUR' })).toEqual({
      value: 99,
      currency: 'EUR',
    })
  })
})
