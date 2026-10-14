// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  createAnalyticsHandler,
  createConsentHandler,
  drizzleStore,
  postgresStore,
  prismaStore,
  readConsentCookie,
  requestInfo,
  supabaseStore,
  upstashStore,
  type ConsentRecord,
  type ServerDestination,
} from '../src/server'

const secret = 'test-secret-that-is-at-least-32-characters'
const granted = { preferences: true, analytics: true, marketing: true }
const denied = { preferences: false, analytics: false, marketing: false }
const post = (url: string, body: unknown, cookie?: string) =>
  new Request(`https://shop.example${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://shop.example', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
const cookieOf = (response: Response) => response.headers.get('set-cookie')!.split(';')[0]

describe('consent handler', () => {
  const setup = () => {
    const records: ConsentRecord[] = []
    const handler = createConsentHandler({
      secret,
      policyVersion: '2026-10-01',
      store: { append: (record) => Promise.resolve(void records.push(record)) },
      userId: () => 'user_1',
    })
    return { records, handler }
  }

  it('appends a record per choice under one consent ID and signs the cookie', async () => {
    const { records, handler } = setup()
    const first = await handler(post('/api/consent', { consent: granted }))
    expect(first.status).toBe(204)
    expect(first.headers.get('set-cookie')).toMatch(
      /^__Host-consentlayer_proof=.+; Path=\/; Max-Age=\d+; HttpOnly; SameSite=Lax; Secure$/,
    )

    const second = await handler(
      post('/api/consent', { consent: { ...denied, extra: true }, restored: true }, cookieOf(first)),
    )
    const { consentId } = records[0]
    expect(consentId).toMatch(/^[\w-]{36}$/)
    expect(records.map(({ createdAt, ...rest }) => [createdAt instanceof Date, rest])).toEqual([
      [true, { consentId, consent: granted, policyVersion: '2026-10-01', userId: 'user_1', restored: false }],
      [true, { consentId, consent: denied, policyVersion: '2026-10-01', userId: 'user_1', restored: true }],
    ])
    const proof = await readConsentCookie(post('/x', {}, cookieOf(second)), { secret })
    expect(proof).toEqual({ consentId, consent: denied, policyVersion: '2026-10-01' })
  })

  it('rejects a short or missing secret before storing anything', async () => {
    const store = { append: vi.fn() }
    const onError = vi.fn()
    for (const secret of ['short', undefined]) {
      const consent = createConsentHandler({ secret, policyVersion: '1', store, onError })
      expect((await consent(post('/api/consent', { consent: granted }))).status).toBe(500)
    }
    const analytics = createAnalyticsHandler({ destinations: [], consentCookie: { secret: 'short' }, onError })
    expect((await analytics(post('/api/analytics', { name: 'x', consent: granted }))).status).toBe(500)
    expect(store.append).not.toHaveBeenCalled()
    expect(onError.mock.calls.map(([error]) => String(error))).toEqual([
      'Error: [consentlayer] the consent secret needs at least 32 characters',
      'Error: [consentlayer] the consent secret is not set',
      'Error: [consentlayer] the consent secret needs at least 32 characters',
    ])
  })

  it('treats every event as denied while consentCookie.secret is unset', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const send = vi.fn()
    const analytics = createAnalyticsHandler({
      destinations: [{ id: 'meta', requiredConsent: 'marketing', forwardBrowserEvents: true, send }],
      consentCookie: { secret: undefined },
    })
    expect(warn).toHaveBeenCalledWith(
      '[consentlayer] consentCookie.secret is not set: every event is treated as denied.',
    )
    expect((await analytics(post('/api/analytics', { name: 'x', consent: granted }))).status).toBe(204)
    expect(send).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('drops Secure and the __Host- prefix from the cookie on localhost only', async () => {
    const consent = createConsentHandler({ secret, policyVersion: '1', store: { append: vi.fn() } })
    const local = new Request('http://localhost:3000/api/consent', {
      method: 'POST',
      body: JSON.stringify({ consent: granted }),
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    })
    expect((await consent(local)).headers.get('set-cookie')).toMatch(/^consentlayer_proof=.+; SameSite=Lax$/)

    const behindProxy = new Request('http://localhost:3000/api/consent', {
      method: 'POST',
      body: JSON.stringify({ consent: granted }),
      headers: { 'content-type': 'application/json', origin: 'https://shop.example' },
    })
    const refused = await consent(behindProxy)
    expect(refused.status).toBe(403)
    expect(refused.headers.get('set-cookie')).toBeNull()
  })

  it('exports requestInfo for sendServerEvent', () => {
    const request = new Request('https://shop.example/x', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'ua', cookie: '_fbp=fb.1' },
    })
    expect(requestInfo(request)).toEqual({ ip: '1.2.3.4', userAgent: 'ua', cookies: { _fbp: 'fb.1' } })
  })

  it('rejects invalid choices and cross-origin posts without recording', async () => {
    const { records, handler } = setup()
    expect((await handler(post('/api/consent', { consent: { analytics: 'true' } }))).status).toBe(400)
    const crossOrigin = new Request('https://shop.example/api/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ consent: granted }),
    })
    expect((await handler(crossOrigin)).status).toBe(403)
    expect(records).toEqual([])
  })

  it('lets the cookie only narrow the body consent and rejects a tampered cookie', async () => {
    const { handler } = setup()
    const cookie = cookieOf(await handler(post('/api/consent', { consent: { ...denied, marketing: true } })))
    const send = vi.fn(() => Promise.resolve())
    const meta: ServerDestination<true> = { id: 'meta', requiredConsent: 'marketing', forwardBrowserEvents: true, send }
    const analytics = createAnalyticsHandler({ destinations: [meta], consentCookie: { secret } })
    const event = (consent: object) => ({ name: 'purchase', consent })

    await analytics(post('/api/analytics', event(denied), cookie))
    expect(send).not.toHaveBeenCalled()
    const valid = await analytics(post('/api/analytics', event(granted), cookie))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ consent: { ...denied, marketing: true } }),
      expect.anything(),
    )
    expect(valid.headers.get('consentlayer-consent')).toBeNull()

    const [name, value] = cookie.split('=') as [string, string]
    const [payload, signature] = value.split('.') as [string, string]
    const forged = btoa(JSON.stringify({ consentId: 'x', consent: granted, policyVersion: 'v' }))
    await analytics(post('/api/analytics', event(granted), `${name}=${forged}.${signature}`))
    await analytics(post('/api/analytics', event(granted), `${name}=${payload}.${signature.slice(1)}x`))
    const missing = await analytics(post('/api/analytics', event(granted)))
    expect(send).toHaveBeenCalledTimes(1)
    expect(missing.headers.get('consentlayer-consent')).toBe('missing')
  })
})

describe('consent stores', () => {
  const record: ConsentRecord = {
    consentId: 'c1',
    createdAt: new Date('2026-10-13T10:00:00Z'),
    consent: granted,
    policyVersion: 'v1',
    restored: false,
  }
  const row = {
    consent_id: 'c1',
    created_at: '2026-10-13T10:00:00.000Z',
    consent: granted,
    policy_version: 'v1',
    user_id: null,
    restored: false,
  }

  it('inserts into Postgres through a sql tagged template', async () => {
    const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => Promise.resolve([strings, values]))
    await postgresStore(sql).append(record)
    const [strings, ...values] = sql.mock.calls[0]
    expect(strings.join('?')).toMatch(
      /^insert into consent_records \(consent_id, created_at, consent, policy_version, user_id, restored\)/,
    )
    expect(values).toEqual(['c1', '2026-10-13T10:00:00.000Z', JSON.stringify(granted), 'v1', null, false])
  })

  it('pushes to an Upstash list per consent ID', async () => {
    const redis = { rpush: vi.fn(() => Promise.resolve(1)) }
    await upstashStore(redis).append(record)
    expect(redis.rpush).toHaveBeenCalledWith('consent:c1', JSON.stringify(record))
  })

  it('inserts a Supabase row and throws its error', async () => {
    const insert = vi.fn((): Promise<{ error: unknown }> => Promise.resolve({ error: null }))
    const supabase = { from: vi.fn(() => ({ insert })) }
    await supabaseStore(supabase).append(record)
    expect(supabase.from).toHaveBeenCalledWith('consent_records')
    expect(insert).toHaveBeenCalledWith(row)
    insert.mockResolvedValueOnce({ error: { message: 'denied' } })
    await expect(supabaseStore(supabase).append(record)).rejects.toThrow('supabase insert failed')
  })

  it('creates a Prisma row and inserts a Drizzle row', async () => {
    const model = { create: vi.fn(() => Promise.resolve({})) }
    await prismaStore(model).append(record)
    expect(model.create).toHaveBeenCalledWith({ data: { ...record, userId: null } })

    const values = vi.fn(() => Promise.resolve())
    const table = { name: 'consent_records' }
    const db = { insert: vi.fn(() => ({ values })) }
    await drizzleStore(db, table).append(record)
    expect(db.insert).toHaveBeenCalledWith(table)
    expect(values).toHaveBeenCalledWith({ ...record, userId: null })
  })
})
