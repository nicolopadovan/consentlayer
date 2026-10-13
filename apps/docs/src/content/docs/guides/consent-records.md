---
title: Consent records
description: Keep proof of each consent choice in your own database, and let the server trust only recorded consent.
---

Regulators can ask you to show that a visitor consented. consentlayer can post
each choice to a route on your server, which appends a record to your database
and answers with a signed cookie. Your tracking route then reads consent from
that cookie, so a request that claims consent the visitor never gave is
ignored.

## Records

Each choice adds a row; rows are never updated.

| Field | What it is |
|---|---|
| `consentId` | a random ID for this browser, kept in the signed cookie, so one visitor's choices share it |
| `createdAt` | when the server received the choice |
| `consent` | every category, e.g. `{ "preferences": false, "analytics": true, "marketing": false }` |
| `policyVersion` | the version of your privacy policy, from the route's options |
| `userId` | the signed-in user, if your `userId` option returns one |

Choices are recorded when the visitor makes them: in the banner, through
`consent.update()` / `setConsent()`, or from a consent adapter such as Shopify.
Restoring a stored choice on a later visit records nothing.

## Setup

Generate a secret of at least 32 characters (`openssl rand -base64 32`) and
set it as `CONSENT_SECRET` on the server only.

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

With `consentCookie`, the tracking route ignores the `consent` in the request
body: a missing or tampered cookie counts as everything denied. The cookie is
`HttpOnly`, `Secure`, `SameSite=Lax` and lasts 400 days, the most browsers
allow. Read it in your own server code with
`readConsentCookie(request, { secret })`.

Events sent in the moment between a choice and the cookie's arrival count as
denied. If the cookie is lost (cleared, expired, another device) while the
browser still holds the choice, server forwarding stays off until the visitor
chooses again.

## Stores

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

To make the table append-only in the database too, revoke `update` and
`delete` on it from the role your app connects with.

### Postgres

`postgresStore(sql)` takes any `sql` tagged template: postgres.js
(`postgres(url)`), Neon (`neon(url)`) or Vercel Postgres (`sql` from
`@vercel/postgres`). The table name is fixed to `consent_records`.

### Supabase

```ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)

supabaseStore(supabase) // or supabaseStore(supabase, { table: 'consent_records' })
```

Create the table above in the SQL editor and turn on row level security with no
policies, so the browser's anon key can neither read nor write it. Use the
service role key on the server.

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

### Upstash Redis and Vercel KV

```ts
import { Redis } from '@upstash/redis'
upstashStore(Redis.fromEnv()) // or upstashStore(kv) with @vercel/kv
```

Each consent ID gets a list, `consent:<consentId>`, with one JSON record per
choice, oldest first. Change the prefix with `{ prefix }`.

### Your own

A store is one function:

```ts
const store: ConsentStore = {
  async append(record) {
    await myDb.insert(record)
  },
}
```

## Retention and deletion

How long you keep records, and deleting a user's records when they ask, are up
to you: the package only appends. Find a visitor's rows by `consent_id` (from
`readConsentCookie`) or `user_id`.
