---
title: Sentry
description: "sentry() reports errors to Sentry without personal data, with Replay and tracing after analytics consent."
---

`sentry()` from `consentlayer/providers/sentry` reports errors to Sentry. It is
built on Sentry's npm SDK, `@sentry/browser`, an optional peer dependency:

```bash
pnpm add @sentry/browser    # sentry()
pnpm add @sentry/nextjs     # consentlayer/sentry/server and consentlayer/sentry/next only
```

```ts
import { sentry } from 'consentlayer/providers/sentry'

sentry({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN })
```

The SDK is imported with a dynamic `import()` when the provider loads, and
Session Replay and tracing, which pull in more code, are off by default and
imported only once enabled and consented to.

## How it works

Sentry reports errors regardless of consent and without personal data: user
info, cookies, HTTP headers, request bodies and URL query strings are not
collected. Analytics consent adds the user ID (and the email address, which
ConsentLayer shares only with marketing consent), Session Replay and tracing.
Withdrawing analytics consent stops Replay and drops transactions.
ConsentLayer installs the window error handlers itself, so Sentry's
`GlobalHandlers` integration is removed.

The Replay integration is imported and added when analytics consent is first
granted, and stopped when it is withdrawn. Granting consent again restarts it
in buffering mode, which records only around errors; session sampling resumes
on the next page load. The tracing integration is added once, on the first
grant. `captureError` calls reach Sentry with their `level`, `extra` and
`tags`, plus a `source` tag of `manual`, `global` or `boundary`.

For Next.js server and edge code, `sentryInstrumentation` from
`consentlayer/sentry/server` configures `@sentry/nextjs` with the same data
collection settings; see [Server errors](/start/nextjs/#server-errors).

## Options

| Option        | Type                                                                    | Default  | Description                                                                                                            |
| ------------- | ----------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `dsn`         | `string \| undefined`                                                   | Required | The project DSN.                                                                                                       |
| `environment` | `string`                                                                | None     | Passed to `Sentry.init`.                                                                                               |
| `release`     | `string`                                                                | None     | Passed to `Sentry.init`.                                                                                               |
| `replay`      | `boolean \| { sessionSampleRate?: number; onErrorSampleRate?: number }` | `false`  | Session Replay after analytics consent. `true` uses a session sample rate of `0.1` and an on-error sample rate of `1`. |
| `tracing`     | `boolean \| { sampleRate?: number }`                                    | `false`  | Performance tracing after analytics consent. `true` uses a sample rate of `1`.                                         |
| `tunnel`      | `string`                                                                | None     | Sends envelopes to this URL instead of the DSN host. See [Sentry](#reverse-proxy).                                     |
| `defer`       | `false \| 'idle' \| 'interaction' \| number`                            | `false`  | See [Loading SDKs later](/guides/providers/#loading-sdks-later).                                                       |

## Reverse proxy

Ad blockers drop requests to `sentry.io`. Serving them through your own
domain avoids this.

`/monitoring?o=<orgId>&p=<projectId>` to
`https://o<orgId>.ingest.sentry.io/api/<projectId>/envelope/`
([Sentry's guide](https://docs.sentry.io/platforms/javascript/troubleshooting/)).
It configures the tunnel only for `@sentry/nextjs`'s own client, so pass it to
`sentry()` as well, with the organisation and project IDs from your DSN,
`https://<key>@o<orgId>.ingest.sentry.io/<projectId>`. If the DSN host is
`o<orgId>.ingest.<region>.sentry.io`, append `&r=<region>`.

```ts
sentry({ dsn, tunnel: '/monitoring?o=<orgId>&p=<projectId>' })
```

The rewrite targets sentry.io only, so it does not work with self-hosted
Sentry, and Next.js rewrites are unavailable in a static export. Exclude the
route from your middleware matcher.
