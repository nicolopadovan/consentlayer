import type { ConsentCategories, ConsentState } from '../core/types'
import { BUILT_IN_CATEGORIES, normalizeConsent } from '../core/utils'
import { assertValidConsent } from '../core/validation'
import { assertSameOrigin, parseCookieHeader, parseJsonWithLimit } from './http'

/** One row of the consent log. Rows are only ever appended. */
export type ConsentRecord = {
  consentId: string
  createdAt: Date
  consent: ConsentState
  policyVersion: string
  userId?: string
}

/** Where `createConsentHandler` appends records. */
export interface ConsentStore {
  append(record: ConsentRecord): Promise<void>
}

/** What the signed cookie proves: this browser's latest recorded choice. */
export type ConsentProof = {
  consentId: string
  consent: ConsentState
  policyVersion: string
}

export type ConsentCookieOptions = {
  /** At least 32 characters, e.g. `process.env.CONSENT_SECRET`. */
  secret: string
  /** Default `consentlayer_proof`. */
  cookie?: string
}

const DEFAULT_COOKIE = 'consentlayer_proof'
// ponytail: browsers cap cookie lifetimes at 400 days
const MAX_AGE = 400 * 24 * 60 * 60

const encoder = new TextEncoder()
const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0))

export function assertSecret(secret: string): void {
  if (!secret || secret.length < 32) throw new Error('[consentlayer] the consent secret needs at least 32 characters')
}

const hmacKey = (secret: string) => {
  assertSecret(secret)
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

async function sign(proof: ConsentProof, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(proof)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

/** The verified proof from the request's consent cookie, or `null` if it is missing or tampered with. */
export async function readConsentCookie(
  request: Request,
  options: ConsentCookieOptions,
): Promise<ConsentProof | null> {
  const value = parseCookieHeader(request.headers.get('cookie') ?? '')[options.cookie ?? DEFAULT_COOKIE]
  const [payload, signature] = value?.split('.') ?? []
  if (!payload || !signature) return null
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(options.secret),
      fromBase64Url(signature),
      encoder.encode(payload),
    )
    return valid ? (JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as ConsentProof) : null
  } catch {
    return null
  }
}

/**
 * A web-standard route handler for `createAnalytics({ server: { consentEndpoint } })`.
 * Validates each choice, appends a record and answers with the signed consent cookie
 * that `createAnalyticsHandler({ consentCookie })` trusts.
 */
export function createConsentHandler(
  options: ConsentCookieOptions & {
    store: ConsentStore
    /** The privacy policy the visitor saw, e.g. `'2026-10-01'`. */
    policyVersion: string
    /** Your own categories, as passed to `createAnalytics({ categories })`. */
    categories?: (keyof ConsentCategories)[]
    /** The signed-in user, from your session. Never read from the request body. */
    userId?: (request: Request) => string | undefined | Promise<string | undefined>
    onError?: (error: unknown) => void
  },
): (request: Request) => Promise<Response> {
  const categories = [...BUILT_IN_CATEGORIES, ...(options.categories ?? [])]
  return async (request) => {
    try {
      assertSecret(options.secret)
      assertSameOrigin(request, { requireHeader: true })
      const body = await parseJsonWithLimit<{ consent?: unknown }>(request, 4 * 1024)
      try {
        assertValidConsent(body?.consent, categories)
      } catch {
        return new Response(null, { status: 400 })
      }
      const consent = normalizeConsent(body.consent as ConsentState, categories)!
      const previous = await readConsentCookie(request, options)
      const consentId = previous?.consentId ?? crypto.randomUUID()
      const userId = await options.userId?.(request)
      await options.store.append({
        consentId,
        createdAt: new Date(),
        consent,
        policyVersion: options.policyVersion,
        ...(userId ? { userId } : {}),
      })
      const cookie = await sign({ consentId, consent, policyVersion: options.policyVersion }, options.secret)
      return new Response(null, {
        status: 204,
        headers: {
          'set-cookie': `${options.cookie ?? DEFAULT_COOKIE}=${cookie}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        },
      })
    } catch (error) {
      const status = (error as { status?: unknown }).status
      if (typeof status === 'number') return new Response(null, { status })
      options.onError?.(error)
      return new Response(null, { status: 500 })
    }
  }
}

const row = (record: ConsentRecord) => ({
  consent_id: record.consentId,
  created_at: record.createdAt.toISOString(),
  consent: record.consent,
  policy_version: record.policyVersion,
  user_id: record.userId ?? null,
})

type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<unknown>

/** Postgres through any `sql` tagged template: postgres.js, Neon or Vercel Postgres. */
export function postgresStore(sql: SqlTag): ConsentStore {
  return {
    async append(record) {
      const r = row(record)
      // ponytail: fixed table name, since tagged templates can't take identifiers portably
      await sql`insert into consent_records (consent_id, created_at, consent, policy_version, user_id)
        values (${r.consent_id}, ${r.created_at}::timestamptz, ${JSON.stringify(r.consent)}::jsonb, ${r.policy_version}, ${r.user_id})`
    },
  }
}

/** Upstash Redis or Vercel KV: one list per consent ID, `consent:<consentId>`. */
export function upstashStore(
  redis: { rpush(key: string, ...values: string[]): Promise<unknown> },
  options: { prefix?: string } = {},
): ConsentStore {
  return {
    async append(record) {
      await redis.rpush(`${options.prefix ?? 'consent:'}${record.consentId}`, JSON.stringify(record))
    },
  }
}

/** supabase-js. */
export function supabaseStore(
  supabase: { from(table: string): { insert(row: object): PromiseLike<{ error: unknown }> } },
  options: { table?: string } = {},
): ConsentStore {
  return {
    async append(record) {
      const { error } = await supabase.from(options.table ?? 'consent_records').insert(row(record))
      if (error) throw new Error('[consentlayer] supabase insert failed', { cause: error })
    },
  }
}

/** Prisma: pass the model, e.g. `prismaStore(prisma.consentRecord)`. */
export function prismaStore(model: { create(args: { data: object }): PromiseLike<unknown> }): ConsentStore {
  return {
    async append(record) {
      await model.create({ data: { ...record, userId: record.userId ?? null } })
    },
  }
}

/** Drizzle: pass the database and the table. */
export function drizzleStore<Table>(
  db: { insert(table: Table): { values(row: object): PromiseLike<unknown> } },
  table: Table,
): ConsentStore {
  return {
    async append(record) {
      await db.insert(table).values({ ...record, userId: record.userId ?? null })
    },
  }
}
