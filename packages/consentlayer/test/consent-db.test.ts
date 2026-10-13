// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  createAnalyticsHandler,
  createConsentHandler,
  drizzleStore,
  postgresStore,
  prismaStore,
  readConsentCookie,
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
    expect(first.headers.get('set-cookie')).toMatch(/^consentlayer_proof=.+; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/)

    const second = await handler(post('/api/consent', { consent: { ...denied, extra: true } }, cookieOf(first)))
    const { consentId } = records[0]
    expect(consentId).toMatch(/^[\w-]{36}$/)
    expect(records.map(({ createdAt, ...rest }) => [createdAt instanceof Date, rest])).toEqual([
      [true, { consentId, consent: granted, policyVersion: '2026-10-01', userId: 'user_1' }],
      [true, { consentId, consent: denied, policyVersion: '2026-10-01', userId: 'user_1' }],
    ])
    const proof = await readConsentCookie(post('/x', {}, cookieOf(second)), { secret })
    expect(proof).toEqual({ consentId, consent: denied, policyVersion: '2026-10-01' })
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

  it('makes the tracking route trust the cookie, not the body, and reject a tampered cookie', async () => {
    const { handler } = setup()
    const cookie = cookieOf(await handler(post('/api/consent', { consent: { ...denied, marketing: true } })))
    const send = vi.fn(() => Promise.resolve())
    const meta: ServerDestination<true> = { id: 'meta', requiredConsent: 'marketing', forwardBrowserEvents: true, send }
    const analytics = createAnalyticsHandler({ destinations: [meta], consentCookie: { secret } })
    const event = (consent: object) => ({ name: 'purchase', consent })

    await analytics(post('/api/analytics', event(denied), cookie))
    expect(send).toHaveBeenCalledTimes(1)

    const [name, value] = cookie.split('=') as [string, string]
    const [payload, signature] = value.split('.') as [string, string]
    const forged = btoa(JSON.stringify({ consentId: 'x', consent: granted, policyVersion: 'v' }))
    await analytics(post('/api/analytics', event(granted), `${name}=${forged}.${signature}`))
    await analytics(post('/api/analytics', event(granted), `${name}=${payload}.${signature.slice(1)}x`))
    await analytics(post('/api/analytics', event(granted)))
    expect(send).toHaveBeenCalledTimes(1)
  })
})

describe('consent stores', () => {
  const record: ConsentRecord = {
    consentId: 'c1',
    createdAt: new Date('2026-10-13T10:00:00Z'),
    consent: granted,
    policyVersion: 'v1',
  }
  const row = {
    consent_id: 'c1',
    created_at: '2026-10-13T10:00:00.000Z',
    consent: granted,
    policy_version: 'v1',
    user_id: null,
  }

  it('inserts into Postgres through a sql tagged template', async () => {
    const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => Promise.resolve([strings, values]))
    await postgresStore(sql).append(record)
    const [strings, ...values] = sql.mock.calls[0]
    expect(strings.join('?')).toMatch(/^insert into consent_records \(consent_id, created_at, consent, policy_version, user_id\)/)
    expect(values).toEqual(['c1', '2026-10-13T10:00:00.000Z', JSON.stringify(granted), 'v1', null])
  })

  it('pushes to an Upstash list per consent ID', async () => {
    const redis = { rpush: vi.fn(() => Promise.resolve(1)) }
    await upstashStore(redis).append(record)
    expect(redis.rpush).toHaveBeenCalledWith('consent:c1', JSON.stringify(record))
  })

  it('inserts a Supabase row and throws its error', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null as unknown }))
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
