---
title: Contentsquare
description: "contentsquare() loads the Contentsquare tag after analytics consent."
---

`contentsquare()` from `consentlayer/providers/contentsquare` loads the
Contentsquare tag once `analytics` consent is granted.

```ts
import { contentsquare } from 'consentlayer/providers/contentsquare'

contentsquare({ tagId: process.env.NEXT_PUBLIC_CONTENTSQUARE_TAG_ID })
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `tagId` | `string \| undefined` | Required | The ID in the tag URL, `https://t.contentsquare.net/uxa/<tagId>.js`. |

## How it works

The tag tracks the initial page view itself, so the first `page()` call for the
path the tag loaded on is skipped. Later page views are sent as
`trackPageview` with the path, without its query string and fragment.
`purchase` is sent as an ecommerce transaction (`transaction_id`, `value` and
`currency` become `id`, `revenue` and `currency`); every other event is sent
as `trackPageEvent` with its name only, without params. `identify` sends the
user ID and `reset` calls `resetIdentity`.

## Withdrawing consent

Contentsquare has no web opt-in. Withdrawing analytics consent pushes
Contentsquare's `optout` command. Granting consent again expires the
`_cs_optout` cookie, which takes effect on the next page load.
