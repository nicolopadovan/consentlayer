---
title: Consent records
description: Keep proof of each consent choice in your own database, and let the server trust only recorded consent.
---

This page covers consent records: the record schema, how long each piece of
consent data is kept, the consent route and its signed cookie, the built-in
stores, and what remains your responsibility.

A regulator can ask you to demonstrate that a visitor consented. With a
consent endpoint configured, ConsentLayer posts each choice to a route on your
server, which appends a record to your database and answers with a signed
cookie. The [tracking route](/guides/server-side-tracking/) can then read
consent from that cookie instead of the request body, so a request claiming
consent the visitor never gave is treated as denied.

## Records

Each choice appends one record. Records are never updated or deleted by
ConsentLayer.

| Field           | Column           | Type               | Content                                                                                                                                                                                                                                                       |
| --------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `consentId`     | `consent_id`     | `string`           | A random UUID identifying the browser. It is kept in the signed cookie, so all of one browser's choices share it.                                                                                                                                             |
| `createdAt`     | `created_at`     | `Date`             | When the server received the choice.                                                                                                                                                                                                                          |
| `consent`       | `consent`        | `ConsentState`     | Every category, such as `{ "preferences": false, "analytics": true, "marketing": false }`, plus `sale_of_data` when it is set.                                                                                                                                |
| `policyVersion` | `policy_version` | `string`           | The privacy policy version, from the route's options.                                                                                                                                                                                                         |
| `userId`        | `user_id`        | `string`, optional | The signed-in user, when your `userId` option returns one.                                                                                                                                                                                                    |
| `restored`      | `restored`       | `boolean`          | `true` when the browser sent a choice it had already stored, because its consent cookie was missing. The visitor did not choose at `createdAt`; their original choice is an earlier record under another `consentId`. See [Lost cookie](#the-consent-cookie). |

A choice is recorded when it changes the stored consent: through the banner,
`analytics.consent.update()` or `setConsent()`, or through a consent
adapter's subscription, such as Shopify's `visitorConsentCollected` event.
A stored choice is also sent again, as a `restored` record, when its cookie
is lost.
Nothing is recorded when a stored choice is restored on a later visit, when a
choice is read from an adapter at bootstrap, when another tab changes the
stored choice, or when a submitted choice is identical to the current one.

## How long data is kept

ConsentLayer never deletes a consent record. Every other piece of consent data
has a fixed lifetime:

| Data                                     | Where                                        | Kept for                                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Consent records                          | Your database, through the [store](#stores)  | Until you delete them. See [Retention and deletion](#retention-and-deletion).                                                                                |
| The consent cookie, `consentlayer_proof` | The visitor's browser                        | 400 days from the last recorded choice (`Max-Age=34560000`), the longest lifetime browsers allow, or until the visitor clears cookies.                       |
| The `consentId`                          | Inside the consent cookie                    | As long as the cookie. Each recorded choice reuses the ID from a valid cookie; without one, a new ID is generated.                                           |
| The visitor's choice                     | `localStorage`, under `consentlayer_consent` | Until the visitor changes it or clears site data, unless you set [`consent.maxAgeDays`](/guides/consent-ui/#asking-again), after which they are asked again. |

The cookie and the stored choice expire independently: with the defaults, a
choice can outlive its cookie. See the lost-cookie case under
[The consent cookie](#the-consent-cookie).

## Setup

Generate a secret of at least 32 characters, for example with
`openssl rand -base64 32`, and set it as `CONSENT_SECRET` on the server only.
The consent route and the tracking route must use the same secret. Both
check it at the start of each request rather than when they are created, so
`next build` succeeds where the secret exists only at runtime.

```ts
// app/api/consent/route.ts
import { createConsentHandler, postgresStore } from 'consentlayer/server'
import { sql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { POLICY_VERSION } from '@/lib/policy'

export const POST = createConsentHandler({
  store: postgresStore(sql),
  secret: process.env.CONSENT_SECRET,
  policyVersion: POLICY_VERSION,
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
  destinations: [metaCapi({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID, accessToken: process.env.META_TOKEN })],
  consentCookie: { secret: process.env.CONSENT_SECRET },
})
```

`server.consentEndpoint` must be an HTTPS URL or a path starting with `/`;
`undefined` or `''` turns recording off, and any other value throws when
`createAnalytics` is called. Each recorded choice is
posted as `{ "consent": { … } }` with `fetch`. A network failure or non-2xx
response is reported to `onError` with scope `consent-adapter` and provider ID
`consent-endpoint`; the choice still applies in the browser.

<details>
<summary><code>createConsentHandler</code> options</summary>

| Option          | Type                                                                        | Default                | Description                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store`         | `ConsentStore`                                                              | Required               | Where records are appended.                                                                                                                                                                                         |
| `secret`        | `string \| undefined`                                                       | Required               | The HMAC key, at least 32 characters.                                                                                                                                                                               |
| `policyVersion` | `string`                                                                    | Required               | Written to every record and to the cookie. Pass the same value to `createAnalytics({ consent: { policyVersion } })`; a new major version asks visitors again. See [Asking again](/guides/consent-ui/#asking-again). |
| `categories`    | `string[]`                                                                  | `[]`                   | Your custom categories, as passed to `createAnalytics({ categories })`. Categories not listed are dropped from the record.                                                                                          |
| `userId`        | `(request: Request) => string \| undefined \| Promise<string \| undefined>` | None                   | Returns the signed-in user from your session. The request body is never used for it.                                                                                                                                |
| `cookie`        | `string`                                                                    | `'consentlayer_proof'` | The cookie name.                                                                                                                                                                                                    |
| `onError`       | `(error: unknown) => void`                                                  | None                   | Receives unexpected errors, such as a store failure.                                                                                                                                                                |

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
5. Calls `userId`, then appends the record to the store, with `restored`
   set when the body has `restored: true`.
6. Answers 204 with the signed cookie.

Responses have no body. If the store or `userId` throws, the error is passed
to `onError`, the response is 500 and no cookie is set.

### The consent cookie

```http
Set-Cookie: consentlayer_proof=<payload>.<signature>; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax; Secure
```

`Secure` is left out when the request's host is `localhost`, `127.0.0.1` or
`[::1]`, because Safari does not store `Secure` cookies on
`http://localhost`.

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
- **Lost cookie.** The cookie can be cleared or expire while the browser
  still stores the choice. The tracking route then answers with the header
  `consentlayer-consent: missing`, and the browser posts the stored choice to
  `server.consentEndpoint` with `restored: true`, once per page load. The
  consent route records it with a new `consentId` and sets a new cookie. The
  event that revealed the loss counts as denied, as do events sent before the
  new cookie arrives. Without `server.consentEndpoint`, events count as denied
  until the visitor makes a choice that differs from the stored one.
- **Secret rotation.** Changing the secret invalidates every existing cookie,
  so each browser restores its cookie as for a lost cookie, adding one
  `restored` record per browser.
- **Missing or short secret.** `createConsentHandler()` answers every request
  with 500 and passes `[consentlayer] the consent secret is not set` or
  `[consentlayer] the consent secret needs at least 32 characters` to
  `onError`. The check runs before the body is read, so no record is stored.
  `createAnalyticsHandler({ consentCookie })` answers 500 for a short secret;
  with the secret unset it logs a `console.warn` once when created and treats
  every event as denied, so environments without `CONSENT_SECRET` send
  nothing.
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
  user_id text,
  restored boolean not null default false
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
  restored      Boolean  @default(false)

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
import { bigint, boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const consentRecords = pgTable(
  'consent_records',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    consentId: text('consent_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    consent: jsonb('consent').notNull(),
    policyVersion: text('policy_version').notNull(),
    userId: text('user_id'),
    restored: boolean('restored').notNull().default(false),
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

ConsentLayer only appends records. Choosing how long to keep them, deleting
old ones and deleting a person's records when they ask are your
responsibility, so schedule the deletion yourself, for example in a cron job.

With the Postgres, Prisma, Drizzle and Supabase stores, records live in the
`consent_records` table, unless you renamed it. To delete records older than a
retention period:

```sql
delete from consent_records where created_at < now() - interval '3 years';
```

A record proves the consent that a browser currently has, so deleting by age
alone can remove the proof for a choice still in force. To keep each browser's
latest record regardless of its age:

```sql
delete from consent_records r
where r.created_at < now() - interval '3 years'
  and exists (
    select 1 from consent_records newer
    where newer.consent_id = r.consent_id and newer.created_at > r.created_at
  );
```

To delete a person's records, find a browser's records by `consent_id`, which
you can read in your own route with
[`readConsentCookie(request, { secret })`](#the-consent-cookie), and a
signed-in user's by `user_id`:

```sql
delete from consent_records where consent_id = $1 or user_id = $2;
```

With the Upstash Redis and Vercel KV store, each browser's records are one
list, so `DEL consent:<consentId>` deletes them. Redis cannot expire single
entries of a list; to delete by age, read the list with `LRANGE`, keep the
entries whose `createdAt` is recent enough, and write them back.
