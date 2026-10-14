---
title: Microsoft Clarity
description: "clarity() loads Microsoft Clarity after analytics consent and passes every consent change to Clarity's consent API."
---

`clarity()` from `consentlayer/providers/clarity` loads Microsoft Clarity once
`analytics` consent is granted and keeps Clarity's consent signals in step
with the visitor's choice.

```ts
import { clarity } from 'consentlayer/providers/clarity'

clarity({ projectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID })
```

## Options

| Option      | Type                  | Default  | Description                                                                                |
| ----------- | --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `projectId` | `string \| undefined` | Required | The project ID in your Clarity tracking code, `clarity.ms/tag/<projectId>`.                |
| `events`    | `boolean`             | `true`   | Sends each `track()` event to Clarity as a custom event, by name. `false` sends no events. |
| `identify`  | `boolean`             | `true`   | Sends the user ID from `identify()` as Clarity's custom ID. `false` sends no user ID.      |
| `defer`     | `LoadTiming`          | `false`  | When to load the script. See [Loading SDKs later](/guides/providers/#loading-sdks-later).  |

## How it works

Once analytics is granted, `clarity()` defines the `window.clarity` queue,
passes the current consent to it and loads
`https://www.clarity.ms/tag/<projectId>`. A failed load is reported to
`onError` with scope `provider-script-load`. Clarity records page views and
sessions itself, so `page()` sends nothing.

`track('sign_up', params)` is sent as `clarity('event', 'sign_up')`; Clarity
custom events carry no parameters. `identify('user-123')` is sent as
`clarity('identify', 'user-123')`. Email addresses and other traits are not
sent.

## Consent

Clarity's
[consent API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
takes two signals. `clarity()` sends them with `clarity('consentv2', …)` when
Clarity loads and again whenever one of them changes:

| Clarity signal      | Granted when           |
| ------------------- | ---------------------- |
| `analytics_Storage` | `analytics` is granted |
| `ad_Storage`        | `marketing` is granted |

When analytics is withdrawn, `clarity()` calls `clarity('consent', false)`,
which erases Clarity's cookies and stops tracking. If analytics is granted
again on the same page, the signals are sent again.

Clarity can record sessions without cookies before consent. `clarity()` does
not use that mode: it loads nothing until analytics is granted.
