---
title: Vercel Analytics
description: "vercel() forwards events to Vercel Analytics, which needs no consent."
---

`vercel()` from `consentlayer/providers/vercel` forwards events to
`track` from `@vercel/analytics`.

```ts
import { track } from '@vercel/analytics'
import { vercel } from 'consentlayer/providers/vercel'

vercel({ trackEvent: track })
```

## Options

| Option       | Type                                                                                   | Default    | Description                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `trackEvent` | `(name: string, payload: Record<string, string \| number \| boolean \| null>) => void` | Required   | `track` from `@vercel/analytics`.                                                                                |
| `events`     | `string[] \| false`                                                                    | All events | The event names `track()` sends to it; `false` sends none. See [Routing events](/guides/events/#routing-events). |

## How it works

Vercel Analytics sets no cookies, so `vercel()` requires no consent and
receives every `track` call. It does not handle page views. Params are
reduced to the types Vercel accepts: `null` and `undefined` become `null`,
strings, numbers and booleans are kept, `Date` values become ISO strings, and
all other values are dropped. To gate it on consent anyway, spread it:
`{ ...vercel(options), requiredConsent: 'analytics' }`.
