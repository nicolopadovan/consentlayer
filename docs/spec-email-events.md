# Spec: email events from sending services (1.10.0)

Status: planned · 2026-10-15 · issue [#63](https://github.com/nicolopadovan/consentlayer/issues/63), milestone 1.10.0

## Goal

An application that sends email through Resend, Postmark, SendGrid, Mailgun or Amazon SES adds one route and
receives every delivery and engagement event the service already emits, verified and normalized into one set of
events, gated per recipient by consent the application keeps in its own database. Swapping the service means swapping
one import. The same events can go to PostHog and GA4 through server destinations, without the recipient's address
ever leaving the application's server.

```ts
// app/api/email-events/route.ts
import { createEmailHandler } from 'consentlayer/email'
import { resendWebhook } from 'consentlayer/email/resend'
import { posthogServer } from 'consentlayer/server/posthog'
import { ga4Server } from 'consentlayer/server/ga4'

export const POST = createEmailHandler({
  service: resendWebhook({ secret: process.env.RESEND_WEBHOOK_SECRET }),
  consent: (recipient, event) => db.emailTrackingConsent(recipient),
  onEvent: (event) => db.emailEvents.insert(event),
  identify: async (event) => ({ userId: await db.userIdByEmail(event.recipient) }),
  secret: process.env.EMAIL_EVENTS_SECRET,
  destinations: [
    posthogServer({ apiKey: process.env.POSTHOG_KEY }),
    ga4Server({ measurementId: process.env.GA4_ID, apiSecret: process.env.GA4_API_SECRET }),
  ],
  onError: console.error,
})
```

## Given (decided by the user, not re-opened)

- ConsentLayer reads the events the services already emit. No tracking pixel and no link rewriting of its own.
- Services in 1.10.0: Resend, Postmark, SendGrid, Mailgun, Amazon SES.
- Normalized events `email_sent`, `email_delivered`, `email_bounced` (hard or soft), `email_complained`,
  `email_opened`, `email_clicked`, `email_unsubscribed`.
- One handler, used like `createAnalyticsHandler`; one import per service.
- Per-recipient consent comes from the application: `consent: (recipient, event) => boolean | Promise<boolean>`.
  Without it, opens and clicks are dropped; delivery, bounce, complaint and unsubscribe events pass.
- Opens likely made by privacy proxies are flagged where the service says so.
- Destinations: the application's own function, plus PostHog and GA4 server destinations.
- Edge-safe: `fetch` and Web Crypto only, no runtime dependencies. Postmark has no signature; basic auth in the
  webhook URL is its documented protection.
- Every new entry point gets its tsup entry, `exports` field, size budget, docs page and sidebar entry, and the
  release a changeset. The docs never claim legal compliance and link the legal notice.

## Decisions taken in this spec

1. **Entry points.** `consentlayer/email` (handler and types) and `consentlayer/email/<service>` for `resend`,
   `postmark`, `sendgrid`, `mailgun` and `ses`. `server/*` holds destinations, things events are sent _to_; a webhook
   source under it would read as a destination. `adapters/*` already means consent-platform adapters. A feature
   directory with sub-entries follows `sentry/server` and `sentry/next`. The PostHog destination is
   `consentlayer/server/posthog`, next to `server/ga4`.
2. **Factory names** are `resendWebhook()`, `postmarkWebhook()`, `sendgridWebhook()`, `mailgunWebhook()` and
   `sesWebhook()`. A bare `resend()` collides with the `const resend = new Resend(key)` every Resend application
   already has. The PostHog destination is `posthogServer()`, after `ga4Server()`.
3. **Two more events.** `email_delayed` (the service is still retrying) and `email_failed` (the service did not send
   the message: dropped, suppressed, rejected or failed to render) are added. Every service but Postmark reports
   both, and an application maintaining a suppression list needs to tell them from bounces.
4. **Consent per event type** (against AGENTS.md "no provider receives data before its consent requirement is
   met"):
   - `email_opened` and `email_clicked` reach the application only when `consent` resolves `true`. They record
     what the recipient did on their own device.
   - Every other event reaches the application's `onEvent` regardless of consent: the application needs them to
     operate the sending itself (suppress bounced and complaining addresses, honour unsubscribes), and the
     application is not a provider.
   - **No event of any type reaches a destination unless `consent` resolved `true` for it.** PostHog and GA4 are
     providers; a delivery or bounce is still data about the recipient. Without a `consent` option, destinations
     receive nothing, and the handler logs one `console.warn` at creation if destinations are set.
   - A destination receives the event with `consent: { preferences: false, analytics: true, marketing: false }`,
     so only destinations whose `requiredConsent` is `analytics` receive it (a marketing destination such as
     `metaCapi` passed here never does), and GA4's `ad_user_data` and `ad_personalization` are `DENIED`.
   - **The developer's choice wins.** These are defaults, not enforcement: `consent` receives the event, so it
     decides per recipient and per type, and `consent: () => true` sends every event of every type to `onEvent` and
     the destinations. To track only operational events without consent:
     `consent: (recipient, event) => !['email_opened', 'email_clicked'].includes(event.name) || hasConsent(recipient)`.
     No extra option is added: the callback already expresses every policy, as options the developer sets win
     elsewhere in ConsentLayer. Whether a policy is lawful is the developer's responsibility; the docs say so once
     and link the legal notice.
5. **The recipient's address never leaves the server.** Destinations get the params `email_service`, `message_id`,
   `bounce_type`, `link_url` and `automated` (each only when present), never the address or the service metadata.
   `identify(event)` may return `{ userId, clientId }`. Without a `clientId`, the handler sets a pseudonym: the
   first 8 bytes of HMAC-SHA-256(`secret`, lowercased recipient) as two unsigned 32-bit integers, `"<a>.<b>"`, the
   format of a GA client ID. HMAC with an application secret, not a plain hash, because Google's policies forbid
   sending email addresses even hashed outside user-provided data, and a plain hash of an address is reversible by
   anyone holding the address. `secret` (at least 32 characters) is required when `destinations` has a defined entry.
6. **GA4 client ID** for recipients: `identify().clientId` when the application saved the visitor's GA client ID
   (for example at sign-up), else the pseudonym above. A fixed client ID would merge every recipient into one GA
   user; a random one would create a new user per event.
7. **GA4 Measurement Protocol is in maintenance mode** per Google's reference page, which recommends the Data
   Manager API for new server-to-server integrations. The existing `ga4Server` (Measurement Protocol) is reused: it
   works, ships today, and needs only an API secret, whereas the Data Manager API needs OAuth with a service
   account. The docs say so; revisit when Google announces a shutdown date.
8. **Event time.** `ServerEvent` gains `time?: number` (Unix milliseconds). The email handler sets it from the
   service's timestamp. `ga4Server` and `sgtm` send `timestamp_micros` when `time` is within the last 72 hours (GA4's
   backdating limit) and omit it otherwise; `posthogServer` sends it as `timestamp`. `createAnalyticsHandler` drops
   a `time` posted by the browser.
9. **Deduplication.** Services deliver at least once and ConsentLayer stores nothing. Every `EmailEvent` has an `id`
   that is stable across the service's retries and unique per normalized event: the Svix `svix-id` (Resend),
   `X-PM-Webhook-Trace-Id` (Postmark, falling back to `RecordType:MessageID:<event time>` when absent),
   `sg_event_id` (SendGrid), `event-data.id` (Mailgun) and the SNS `MessageId` (SES). When one notification expands
   into several events (several recipients), each gets `<id>:<recipient>`. `onEvent` may return `false` (for
   example after seeing the `id` before) and the event then skips the destinations. GA4 has no deduplication, so
   this is the only protection there.
10. **Replay protection** is a timestamp window, not a token cache: 5 minutes for Resend, SendGrid and Mailgun,
    1 hour for SES (SNS retries keep the original `Timestamp`), each overridable with `toleranceSeconds`. A replay
    inside the window is caught by deduplicating on `id`. Postmark sends no signed timestamp and has no window.
11. **Order and failure.** Per request: read the body (limit 1 MiB), verify, normalize, then for each event in
    parallel: consent, `onEvent` (awaited), `identify`, destinations. A failure of `consent`, `onEvent` or `identify`
    answers 500 so the service retries; a destination failure goes to `onError` and still answers 200, as
    `createAnalyticsHandler` does. Successful responses are 200 with no body (some services document 200, all
    accept it).
12. **Unset secrets fail closed.** A service factory takes its credential as `string | undefined`, for environment variables.
    While it is unset, every request answers 500 and is reported to `onError`; nothing is accepted unverified, and
    the service keeps retrying until the variable is set.
13. **Postmark** takes `{ username, password }`; the webhook URL is `https://<username>:<password>@host/path` and the
    adapter compares the `Authorization: Basic` header in constant time. `password` needs at least 32 characters.
14. **SES via SNS only.** `sesWebhook({ topicArns })` verifies the SNS signature (versions 1 and 2), fetches the
    signing certificate only from an `https://sns.<region>.amazonaws.com` host, extracts its public key with a
    small DER walk, and accepts only listed topics. Web Crypto cannot validate the certificate chain; the host
    allowlist over HTTPS and the topic allowlist are the trust root, and the docs say so. A verified
    `SubscriptionConfirmation` for a listed topic is confirmed by fetching its `SubscribeURL` (same host rule). Both
    SES event publishing (`eventType`) and the older notifications (`notificationType`) are read. EventBridge is
    deferred: it uses the same event shape, so a later `sesEventBridge()` reuses the normalizer, but it offers only
    a static shared header and adds a second AWS setup to document and test.
15. **Messages with several recipients.** Resend and SES report opens and clicks per message, not per recipient.
    An `email_opened` or `email_clicked` for a message with more than one recipient is dropped, since the event
    cannot be attributed to one recipient's consent. Other events are emitted once per recipient.
16. **Proxy and bot opens** are flagged, not dropped: `automated` is `true` or `false` when the service says, and
    absent when it does not (Resend and Postmark). An application that wants them gone returns `false` from
    `consent` for `event.automated === true`.
17. **Unknown event types** (Resend `email.scheduled`, `email.received`, SendGrid `group_resubscribe`, Postmark
    `SubscriptionChange` with `SuppressSending: false`, …) are ignored and answered 200.
18. **No script-tag build.** These are server entries; the rule that a new provider joins `src/global` applies to
    browser providers only.

## Event model

```ts
type EmailEventName =
  | 'email_sent' | 'email_delivered' | 'email_delayed' | 'email_bounced' | 'email_failed'
  | 'email_complained' | 'email_opened' | 'email_clicked' | 'email_unsubscribed'

type EmailEvent = {
  id: string                         // stable across retries; see decision 9
  name: EmailEventName
  service: 'resend' | 'postmark' | 'sendgrid' | 'mailgun' | 'ses'
  recipient: string
  messageId?: string                 // the service's message ID
  timestamp: Date
  bounce?: 'hard' | 'soft'           // email_bounced only
  reason?: string                    // the service's diagnostic, for bounced, failed and delayed
  url?: string                       // email_clicked only
  automated?: boolean                // opens and clicks; see decision 16
  metadata: Record<string, string>   // the values the application attached when sending
  raw: unknown                       // the service's own event
}

interface EmailService {
  id: EmailEvent['service']
  /** Verifies the request; returns its events, or a Response for a control message such as an SNS confirmation. */
  receive(request: Request, body: string): Promise<EmailEvent[] | Response>
}
```

`EmailService` is exported so an application can write a source for another service. The names are not added to
`StandardEvents` or `Register`: the browser never tracks them.

## Mapping

| Event                | Resend                                     | Postmark                                              | SendGrid                                              | Mailgun                                        | SES (`eventType` / `notificationType`)          |
| -------------------- | ------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `email_sent`         | `email.sent`                               | none                                                  | `processed`                                           | `accepted`                                     | `Send`                                          |
| `email_delivered`    | `email.delivered`                          | `Delivery`                                            | `delivered`                                           | `delivered`                                    | `Delivery`, per `delivery.recipients`           |
| `email_delayed`      | `email.delivery_delayed`                   | none                                                  | `deferred`                                            | `failed`, severity `temporary`                 | `DeliveryDelay`                                 |
| `email_bounced` hard | `email.bounced`, `bounce.type` `Permanent` | `Bounce`, `HardBounce` and `BadEmailAddress`          | `bounce` (type `bounce`)                              | `failed`, `permanent`, reason not `suppress-*` | `Bounce`, `Permanent`, per bounced recipient    |
| `email_bounced` soft | `email.bounced`, `Temporary`               | `Bounce`, every other type except `SpamComplaint`     | `bounce` (type `blocked`)                             | none                                           | `Bounce`, `Transient` or `Undetermined`         |
| `email_failed`       | `email.failed`, `email.suppressed`         | none                                                  | `dropped`                                             | `failed`, `permanent`, reason `suppress-*`     | `Reject`, `Rendering Failure`                   |
| `email_complained`   | `email.complained`                         | `SpamComplaint`, and `Bounce` of type `SpamComplaint` | `spamreport`                                          | `complained`                                   | `Complaint`, per complained recipient           |
| `email_opened`       | `email.opened`                             | `Open`                                                | `open`                                                | `opened`                                       | `Open`                                          |
| `email_clicked`      | `email.clicked`                            | `Click`                                               | `click`                                               | `clicked`                                      | `Click`                                         |
| `email_unsubscribed` | none in 1.10.0                             | `SubscriptionChange` with `SuppressSending: true`     | `unsubscribe`, `group_unsubscribe`                    | `unsubscribed`                                 | `Subscription`                                  |
| `automated`          | absent                                     | absent                                                | `sg_machine_open` (opens)                             | `client-info.bot` non-empty                    | `open.isBotEvent` / `click.isBotEvent` `Likely` |
| `metadata`           | `data.tags`                                | `Metadata`                                            | custom args (top-level fields outside SendGrid's own) | `user-variables`                               | `mail.tags`, first value per key                |

## Signature verification

| Service  | Credential option                  | Check                                                                                                                               |
| -------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Resend   | `secret` (`whsec_…`)               | HMAC-SHA-256, key = base64 after `whsec_`, over `${svix-id}.${svix-timestamp}.${body}`; any `v1,` entry of `svix-signature` matches |
| Postmark | `username`, `password`             | `Authorization: Basic` equals the credentials, constant time                                                                        |
| SendGrid | `publicKey` (the verification key) | ECDSA P-256 SHA-256 over `${timestamp}${body}`; the base64 DER signature converted to raw `r‖s` for Web Crypto                      |
| Mailgun  | `signingKey`                       | HMAC-SHA-256 hex over `${timestamp}${token}` from the body's `signature` object                                                     |
| SES      | `topicArns`                        | SNS RSA signature (v1 SHA-1, v2 SHA-256) over the documented string to sign, certificate from an allowed host                       |

Every comparison of secrets or MACs is constant time. Mailgun signs only the timestamp and token, not the event,
so the event body is protected by TLS alone; the docs say so.

## To verify before relying on it

Each item is marked [unverified] in the research. The implementer of the step that relies on it checks it against
the vendor's current documentation or a real payload, records the source in the pull request, and replaces any
fixture that differs from a real payload.

1. Resend/Svix: the 5-minute tolerance Svix's own libraries use, and whether each retry is signed with a fresh
   `svix-timestamp`.
2. Resend: the payloads of `email.failed` and `email.suppressed`; whether `contact.topics.updated` or
   `suppression.added` should map to `email_unsubscribed` (not mapped in 1.10.0 until verified).
3. Postmark: that a URL with credentials produces an `Authorization: Basic` header; that `X-PM-Webhook-Trace-Id` is
   stable across retries; the full bounce `Type` table behind the hard/soft split.
4. SendGrid: the key is P-256 in base64 SPKI DER; the signature is DER; whether the timestamp header changes on
   retry; the maximum batch size (the 1 MiB limit must exceed it); which top-level fields are SendGrid's own, so
   custom args can be told apart.
5. Mailgun: the `event` value of failures (`failed` versus `permanent_fail`/`temporary_fail`), the `reason` values
   of suppressed sends, whether `client-info.bot` is present on clicks, and that a 200 with no body is accepted.
6. SNS: the exact certificate host pattern (including China and GovCloud partitions), RSASSA-PKCS1-v1_5 padding,
   SHA-1 support for version 1 in Cloudflare Workers, Vercel Edge and Deno, and whether retries keep `Timestamp`.
7. SES: the `Subscription` event payload, and the field names `open.isBotEvent` and `click.isBotEvent`.
8. PostHog: the single-event capture endpoint and body shape (`/i/v0/e/`, `api_key`, `properties.distinct_id`,
   `timestamp`).
9. GA4: what happens to an event whose `timestamp_micros` is older than 72 hours, and to param values over 100
   characters (the handler sends `link_url` to GA4 through `providers.ga4` truncated to 100 characters).

## Out of scope

- A tracking pixel or link rewriting of ConsentLayer's own.
- Storage of any kind, including a replay-token cache (decision 10).
- Deferred to a later release and named on the roadmap: SES through EventBridge (decision 14) and Resend unsubscribe
  events (verification item 2).
- Postmark IP allowlists and SendGrid OAuth.
- A separate per-event-type consent option: `consent` covers it (decision 4).
- The GA4 EU endpoint (`region1.google-analytics.com`) and the Data Manager API.
- Extra params or `only` per event for destinations; forwarding browser events to `posthogServer`.

## Acceptance criteria

- **AC-1** The roadmap page lists "Email events from sending services" in the Planned table with priority Medium and
  target April 2027, linking to a section that describes the feature in the page's tone; `pnpm --filter docs build`
  passes.
- **AC-2** `consentlayer/email`, `consentlayer/email/{resend,postmark,sendgrid,mailgun,ses}` and
  `consentlayer/server/posthog` each have a tsup entry, an `exports` field and a size budget in `.size-limit.js` set
  at the built size rounded up to the next 0.1 kB; `dist/email` is excluded from the es-check browser check and
  `src/email/**` from the ESLint compat rules; none is in the script-tag build; `package.json` gains no
  `dependencies`; `src/email` and `src/server/posthog.ts` import no `node:` module. `pnpm --filter consentlayer
check:package` passes.
- **AC-3** `createEmailHandler` answers 200 with no body for an accepted request, including one whose events are all
  of unknown types; 401 for a missing or wrong signature or credentials, and for a timestamp outside the tolerance;
  400 for a body that is not the service's shape; 413 for a body over 1 MiB; 500, reported to `onError`, while the
  service's secret is unset or too short, while `destinations` has a defined entry and `secret` is unset or shorter than 32
  characters, and when `consent`, `onEvent` or `identify` throws. A destination failure is reported to `onError` and
  the answer is still 200. It applies no same-origin check.
- **AC-4** `email_opened` and `email_clicked` reach `onEvent` only when `consent(recipient, event)` resolves `true`,
  and are dropped when the option is absent. Every other event reaches `onEvent` whatever `consent` returns.
- **AC-5** An event reaches a destination only when `consent` resolved `true` for it, with consent
  `{ preferences: false, analytics: true, marketing: false }`: a test shows an `analytics` destination receiving it
  and `metaCapi` passed in the same list receiving nothing. Without `consent`, no destination is called and the
  handler warns once at creation. With `consent: () => true`, every event type, opens and clicks included, reaches
  `onEvent` and the `analytics` destinations; with a callback that returns `true` only for operational types, opens
  and clicks are dropped while the rest reach the destinations.
- **AC-6** The `ServerEvent` a destination receives has `name` = the event name, `id` = the event `id`, `time` = the
  event time, params limited to `email_service`, `message_id`, `bounce_type`, `link_url` and `automated`, and no
  recipient address or metadata anywhere in the outgoing request body (asserted on the serialized request).
  `identity.userId` comes from `identify`; `clientId` comes from `identify`, else is the HMAC pseudonym, which is
  equal for two events of the same address in different case and differs between two secrets. `link_url` reaches
  GA4 through `providers.ga4` truncated to 100 characters and other destinations in full.
- **AC-7** `onEvent` is awaited before any destination is called; when it returns `false`, no destination is called
  for that event; when it throws, the answer is 500 and no destination is called for that event.
- **AC-8** Resend: a request signed like Svix is accepted; a wrong signature, a wrong secret and a timestamp older
  than the tolerance answer 401; a header with several `v1,` entries is accepted when one matches. Fixtures shaped
  after Resend's documented examples normalize per the mapping table, including `id` from `svix-id`.
- **AC-9** Postmark: correct credentials are accepted; a missing or wrong `Authorization` header answers 401.
  Fixtures for every mapped `RecordType` and the hard, soft and complaint bounce types normalize per the table; `id`
  is the trace ID, or the documented fallback when the header is absent.
- **AC-10** SendGrid: a batch signed with a P-256 key (DER signature, as SendGrid sends) is accepted; a tampered
  body, a wrong key and a stale timestamp answer 401. A batch of several events becomes several `EmailEvent`s;
  `sg_machine_open` sets `automated`; custom args become `metadata`.
- **AC-11** Mailgun: a correct signature is accepted; a wrong signature or key and a stale timestamp answer 401.
  Fixtures normalize per the table, including the temporary/permanent/suppressed split of `failed` and
  `client-info.bot` → `automated`.
- **AC-12** SES: an SNS notification signed with a test certificate (a committed test key and self-signed
  certificate, served through `fetchImpl`) is accepted for signature versions 1 and 2; a tampered message, a
  certificate URL outside the allowed hosts or not HTTPS, and a topic not in `topicArns` answer 401 without fetching
  anything for the last two. A verified `SubscriptionConfirmation` for a listed topic fetches its `SubscribeURL`
  once; for an unlisted topic or a bad signature it fetches nothing. Both `eventType` and `notificationType`
  messages normalize; a bounce with two recipients yields two events with ids `<MessageId>:<recipient>`; an open of
  a message with two destinations is dropped; `isBotEvent` sets `automated`.
- **AC-13** `posthogServer` from `consentlayer/server/posthog` requires analytics consent, has
  `forwardBrowserEvents: false` and `id` `posthog`, returns `undefined` while `apiKey` is unset, throws at creation
  for an `apiHost` that is not HTTPS, and posts one event to `<apiHost>/i/v0/e/` with `api_key`, `event`,
  `properties.distinct_id` (`identity.userId`, else `clientId`, else it throws), `$process_person_profile: false`
  when there is no `userId`, the params merged with `providers.posthog`, and `timestamp` from `time`. A non-2xx
  response throws.
- **AC-14** `ServerEvent.time` is sent as `timestamp_micros` by `ga4Server` and `sgtm` when within 72 hours and
  omitted otherwise; `createAnalyticsHandler` ignores a `time` in the browser's body; `server/ga4` has a size budget.
- **AC-15** The docs have an "Email events" guide page in the Guides sidebar after Server-side tracking, covering
  the handler, the consent rules per event type and how to change them with `consent` (including `() => true` to
  send everything), stated once as the developer's decision and responsibility with a link to the legal notice and
  without further warnings, deduplication, the proxy-open flags (stating that Resend and
  Postmark provide none), each service's setup and verification, and the GA4 maintenance-mode note; the server-side
  tracking page documents `posthogServer` and `time`; the API reference documents every new export. The pages link
  the legal notice, never say a setup complies with a law, and name the product ConsentLayer in prose.
- **AC-16** A changeset bumps `consentlayer` by a minor version and lists the new entry points and the budgets they
  add.
- **AC-17** Every verification item above is checked by the step that relies on it, with its source in the pull
  request description.
- **AC-18** `pnpm format:check`, `pnpm knip`, `pnpm turbo run typecheck lint test build` and
  `pnpm --filter consentlayer check:package` pass.
