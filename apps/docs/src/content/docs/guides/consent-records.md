---
title: Consent records
description: Keep proof of each consent choice in your own database, and let the server trust only recorded consent.
---

This page covers consent records: the record schema, the consent route and
its signed cookie, the built-in stores, and what remains your responsibility.

A regulator can ask you to demonstrate that a visitor consented. With a
consent endpoint configured, ConsentLayer posts each choice to a route on your
server, which appends a record to your database and answers with a signed
cookie. The [tracking route](/guides/server-side-tracking/) can then read
consent from that cookie instead of the request body, so a request claiming
consent the visitor never gave is treated as denied.

## Records

Each choice appends one record. Records are never updated or deleted by
ConsentLayer.

| Field | Column | Type | Content |
|---|---|---|---|
| `consentId` | `consent_id` | `string` | A random UUID identifying the browser. It is kept in the signed cookie, so all of one browser's choices share it. |
| `createdAt` | `created_at` | `Date` | When the server received the choice. |
| `consent` | `consent` | `ConsentState` | Every category, such as `{ "preferences": false, "analytics": true, "marketing": false }`, plus `sale_of_data` when it is set. |
| `policyVersion` | `policy_version` | `string` | The privacy policy version, from the route's options. |
| `userId` | `user_id` | `string`, optional | The signed-in user, when your `userId` option returns one. |

A choice is recorded when it changes the stored consent: through the banner,
`analytics.consent.update()` or `setConsent()`, or through a consent
adapter's subscription, such as Shopify's `visitorConsentCollected` event.
Nothing is recorded when a stored choice is restored on a later visit, when a
choice is read from an adapter at bootstrap, when another tab changes the
stored choice, or when a submitted choice is identical to the current one.

## Setup

Generate a secret of at least 32 characters, for example with
`openssl rand -base64 32`, and set it as `CONSENT_SECRET` on the server only.
The consent route and the tracking route must use the same secret.

```ts
// app/api/consent/route.ts
import { createConsentHandler, postgresStore } from 'consentlayer/server'
import { sql } from '@/lib/db'
import { auth } from '@/lib/auth'

export const POST = createConsentHandler({
  store: postgresStore(sql),
  secret: process.env.CONSENT_SECRET!,
  policyVersion: '2026-10-01',
  userId: async () => (await auth())?.user.id,
  // categories: ['functional'], if you declared custom categories
})
```

```ts
// lib/analytics.ts
export const analytics = createAnalytics({
  server: { endpoint: '/api/analytics', consentEndpoint: '/api/consent' },
  // ...
})
```

```ts
// app/api/analytics/route.ts
export const POST = createAnalyticsHandler({
  destinations: [metaCapi({ pixelId, accessToken: process.env.META_TOKEN! })],
  consentCookie: { secret: process.env.CONSENT_SECRET! },
})
```

`server.consentEndpoint` must be an HTTPS URL or a path starting with `/`; any
other value throws when `createAnalytics` is called. Each recorded choice is
posted as `{ "consent": { … } }` with `fetch`. A network failure or non-2xx
response is reported to `onError` with scope `consent-adapter` and provider ID
`consent-endpoint`; the choice still applies in the browser.

<details>
<summary><code>createConsentHandler</code> options</summary>

| Option | Type | Default | Description |
|---|---|---|---|
| `store` | `ConsentStore` | Required | Where records are appended. |
| `secret` | `string` | Required | The HMAC key, at least 32 characters. |
| `policyVersion` | `string` | Required | Written to every record and to the cookie. |
| `categories` | `string[]` | `[]` | Your custom categories, as passed to `createAnalytics({ categories })`. Categories not listed are dropped from the record. |
| `userId` | `(request: Request) => string \| undefined \| Promise<string \| undefined>` | None | Returns the signed-in user from your session. The request body is never used for it. |
| `cookie` | `string` | `'consentlayer_proof'` | The cookie name. |
| `onError` | `(error: unknown) => void` | None | Receives unexpected errors, such as a store failure. |

</details>

### The consent route

`createConsentHandler` returns a web-standard
`(request: Request) => Promise<Response>`. For each request it:

1. Checks the origin as the tracking route does. A request without an
   `Origin` or `Referer` header, or from another origin, gets 403.
2. Reads the body. A `Content-Type` other than `application/json` gets 415, a
   body over 4 KB (4,096 bytes) gets 413, and an empty body or invalid JSON
   gets 400.
3. Validates `consent`: every built-in category and every category in
   `categories` must be a boolean, and `sale_of_data`, if present, a boolean.
   Otherwise it answers 400.
4. Reuses the `consentId` from a valid existing cookie, or generates one with
   `crypto.randomUUID()`.
5. Calls `userId`, then appends the record to the store.
6. Answers 204 with the signed cookie.

Responses have no body. If the store or `userId` throws, the error is passed
to `onError`, the response is 500 and no cookie is set.

### The consent cookie

```http
Set-Cookie: consentlayer_proof=<payload>.<signature>; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax
```

`Max-Age` is 400 days, the longest lifetime browsers allow. The payload is the
base64url-encoded JSON of `{ consentId, consent, policyVersion }`; the
signature is the base64url-encoded HMAC-SHA-256 of the encoded payload, keyed
with the secret. Both use the URL-safe alphabet without padding.

With `consentCookie` set, the tracking route ignores the `consent` in the
request body. A missing cookie, a malformed value or a signature that does not
verify counts as every category denied. In your own server code, read the
verified contents with `readConsentCookie(request, { secret })`, which
resolves to `{ consentId, consent, policyVersion }` or `null`.

<details>
<summary>Edge cases</summary>

- **Before the cookie arrives.** Events forwarded between a choice and the
  consent route's response carry no cookie yet, so they count as denied.
- **Lost cookie.** If the cookie is cleared or expires, or the visitor uses
  another browser, while the browser still stores the choice, server
  forwarding counts as denied until the visitor makes a choice that differs
  from the stored one. Submitting an identical choice posts nothing.
- **Secret rotation.** Changing the secret invalidates every existing cookie,
  with the same effect as a lost cookie.
- **Short secret.** With a secret under 32 characters, `readConsentCookie`
  returns `null` and the consent route answers 500, passing the error
  `[consentlayer] the consent secret needs at least 32 characters` to
  `onError`.
- **Policy version.** The cookie is not checked against the current
  `policyVersion`; a cookie signed under an earlier version still verifies.

</details>

## Stores

A store implements one method, `append(record: ConsentRecord): Promise<void>`.
Every SQL store writes to the same `consent_records` table:

```sql
create table consent_records (
  id bigint generated always as identity primary key,
  consent_id text not null,
  created_at timestamptz not null,
  consent jsonb not null,
  policy_version text not null,
  user_id text
);
create index on consent_records (consent_id);
create index on consent_records (user_id);
```

To make the table append-only in the database as well, revoke `update` and
`delete` on it from the role your application connects with.

### Postgres

`postgresStore(sql)` takes any `sql` tagged template that returns a promise:
postgres.js (`postgres(url)`), Neon (`neon(url)`) or Vercel Postgres (`sql`
from `@vercel/postgres`). It runs a parameterised `insert`, casting
`created_at` to `timestamptz` and `consent` to `jsonb`. The table name is
fixed to `consent_records`, because tagged templates cannot parameterise
identifiers portably.

### Supabase

```ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)

supabaseStore(supabase) // or supabaseStore(supabase, { table: 'consent_records' })
```

`supabaseStore` inserts one row with snake_case columns into `consent_records`,
or the table named by `table`, and throws
`[consentlayer] supabase insert failed`, with Supabase's error as `cause`,
when the insert returns an error. Create the table above in the SQL editor
and enable row level security with no policies, so the browser's anon key can
neither read nor write it. Use the service role key on the server only.

### Prisma

```prisma
model ConsentRecord {
  id            BigInt   @id @default(autoincrement())
  consentId     String   @map("consent_id")
  createdAt     DateTime @map("created_at") @db.Timestamptz
  consent       Json
  policyVersion String   @map("policy_version")
  userId        String?  @map("user_id")

  @@index([consentId])
  @@index([userId])
  @@map("consent_records")
}
```

```ts
prismaStore(prisma.consentRecord)
```

`prismaStore` calls `create` on the model with the record's camelCase fields,
setting `userId` to `null` when there is none.

### Drizzle

```ts
import { bigint, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const consentRecords = pgTable(
  'consent_records',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    consentId: text('consent_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    consent: jsonb('consent').notNull(),
    policyVersion: text('policy_version').notNull(),
    userId: text('user_id'),
  },
  (table) => [index().on(table.consentId), index().on(table.userId)],
)
```

```ts
drizzleStore(db, consentRecords)
```

`drizzleStore` calls `db.insert(table).values(…)` with the record's camelCase
fields, setting `userId` to `null` when there is none.

### Upstash Redis and Vercel KV

```ts
import { Redis } from '@upstash/redis'
upstashStore(Redis.fromEnv()) // or upstashStore(kv) with @vercel/kv
```

Each consent ID has a list, `consent:<consentId>`. Every choice is appended
with `RPUSH` as the record's JSON, with `createdAt` as an ISO 8601 string, so
the list is ordered oldest first. Change the key prefix with
`upstashStore(redis, { prefix })`.

### Your own

```ts
import type { ConsentStore } from 'consentlayer/server'

const store: ConsentStore = {
  async append(record) {
    await myDb.insert(record)
  },
}
```

A rejected promise makes the consent route answer 500 without setting the
cookie.

## Retention and deletion

How long you keep records, and deleting a person's records when they ask, are
your responsibility: ConsentLayer only appends. Find a browser's records by
`consent_id`, read from the cookie with `readConsentCookie`, and a signed-in
user's by `user_id`.
