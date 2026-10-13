---
title: Writing a plugin
description: The plugin contract, what each hook receives, and what the manager guarantees around it.
sidebar:
  order: 5
---

Every built-in provider (GA4, Meta Pixel, PostHog, Sentry and the rest) is a
plain object that the manager drives through hooks. A plugin of your own uses
the same contract and gets the same consent handling. This page describes the
contract; [Lifecycle](/internals/lifecycle/) describes when the manager calls
each hook.

## The contract

`definePlugin(plugin)` returns its argument unchanged. It exists only so
TypeScript checks the object against `AnalyticsPlugin`.

```ts
type LoadTiming = false | 'idle' | 'interaction' | number

interface AnalyticsPlugin {
  id: string
  requiredConsent?: 'none' | ConsentCategory // 'preferences', 'analytics', 'marketing' or a custom category
    | ((consent: ConsentState | null) => boolean)
  loadBeforeConsent?: boolean
  defer?: LoadTiming
  setup?(ctx): void | Promise<void>
  load?(ctx): void | Promise<void>
  consent?(ctx): void | Promise<void>
  page?(page, ctx): void | Promise<void>
  track?(event, ctx): void | Promise<void>
  identify?(identity, traits, ctx): void | Promise<void>
  reset?(ctx): void | Promise<void>
  group?(groupId, traits, ctx): void | Promise<void>
  error?(error, context, ctx): void | Promise<void>
  teardown?(ctx): void | Promise<void>
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique per instance. It is the key for `only`, `activeProviders` and `onError`'s `providerId`. Registering a second plugin with an existing `id` keeps the first one. |
| `requiredConsent` | Default `'none'`: the plugin is active even before the visitor chooses. A function is called with the current consent and only once consent is known. |
| `loadBeforeConsent` | Run `load` before consent allows the plugin. It still gets no events until it does. |
| `defer` | Delay `load`: milliseconds, `'idle'` or `'interaction'`. Events wait in a backlog meanwhile. |

### Hooks

Every hook gets a `PluginContext` as its last argument, built fresh for each
call:

| `ctx` field | Value |
| --- | --- |
| `consent` | Current `ConsentState`, or `null` before the visitor has chosen |
| `identity` | The known identity: `userId`, plus `email` and `phone` only with marketing consent |
| `debug` | The `debug` option |
| `emitError` | Reports an `AnalyticsError` to `onError`; `providerId` defaults to this plugin's `id` |

| Hook | Called | Arguments before `ctx` |
| --- | --- | --- |
| `setup` | Once, on the first lifecycle pass after boot, whatever the consent. No network, no cookies. | none |
| `consent` | On every lifecycle pass: boot, each consent change, each provider registration. | none |
| `load` | Once, when the plugin is first allowed (or at boot with `loadBeforeConsent`), after `defer`. Inject scripts here. | none |
| `page` | For each page view while active. | `PageEvent`: `url`, `path`, `title`, plus `id` |
| `track` | For each event while active. | `AnalyticsEventPayload`: `id`, `name`, `params`, `options` |
| `identify` | On `identify()`, on activation if an identity is known, and when marketing consent changes. | `identity`, `traits` (never `email` or `phone`; those are in `identity`) |
| `reset` | On `reset()`, and when marketing is withdrawn from an inactive plugin. | none |
| `group` | On `group()` while active. | `groupId`, `traits` |
| `error` | On `captureError()` and on uncaught errors while active. | `error`, `ErrorContext`: `level`, `tags`, `extra`, `source` |
| `teardown` | When consent no longer allows the plugin, when it is unregistered, and on `destroy()`. Stop sending; remove cookies where possible. | none |

`consent` can run before `load` (it does on the first pass), and `teardown`
can run without `load` ever having run. A plugin that needs both its SDK and
the consent should store the context in `consent` and apply it at the end of
`load`; the PostHog provider does exactly this.

`load` is not called again after a teardown. When the visitor grants consent
again, the plugin becomes active and receives `consent` and events, so
`teardown` should leave the SDK in a state that `consent` can turn back on.

### Helpers

| Export | What it does |
| --- | --- |
| `loadScript(src, attributes?)` | Appends `<script async src>` to `<head>` with the given attributes. Resolves on `load`, rejects with `Failed to load <src>` on `error`. Relative `src` is resolved against the page, so each script is added once: a second call while it loads gets the same promise, a script already in the document resolves at once, and a failed load is removed so it can be retried. Resolves at once outside the browser. |
| `setFlag(name, value)` | Sets `window.__<prefix><name>` (and the legacy `__acm<name>` when `names.legacy` is on). Use it to mark one-time global setup. |
| `getFlag(name)` | Reads that flag, falling back to the legacy name when `legacy` is on. |

A rejected `loadScript` inside `load` is caught by the manager and reported as
`provider-load`. The built-in providers catch it themselves and call
`emitError({ scope: 'provider-script-load', ... })` so it can be told apart.

## What the manager guarantees

- **Consent is checked for you.** `page`, `track`, `identify`, `group` and
  `error` only run while the plugin is active and its `requiredConsent` holds
  at that moment. You don't need to check consent in those hooks.
- **Lifecycle hooks never overlap.** `setup`, `consent`, `load` and
  `teardown` run on one queue, one plugin at a time, in registration order.
- **Order is kept.** Events reach plugins in the order they were made, one
  plugin after another. A plugin's async hook is awaited before the next
  plugin gets the event.
- **Events wait for a deferred `load`.** While a deferred `load` is pending,
  event hooks are queued (up to 100) and replayed after it in order. If
  consent is withdrawn first, they are discarded and `load` doesn't run.
- **Errors stay contained.** A hook that throws or rejects is caught; the
  error goes to `onError` with scope `provider-<hook>` (`identify`, `reset`
  and `group` all use `provider-identify`). Other plugins and your app carry
  on.
- **Nothing after `destroy()`.** Once the instance is destroyed, no hook runs.
- **Same IDs everywhere.** `page.id` and `event.id` are the IDs the server
  receives, so a server destination can deduplicate against your plugin.

The manager doesn't make your hooks idempotent or stop your SDK from setting
cookies; that's the plugin's job.

## Example: a beacon logger

This plugin sends page views and events to your own endpoint with
`navigator.sendBeacon`. It needs analytics consent and loads at idle time.

```ts
import { definePlugin } from 'consentlayer'

export function beaconLogger(endpoint: string) {
  const send = (body: Record<string, unknown>) =>
    navigator.sendBeacon(endpoint, JSON.stringify(body))

  return definePlugin({
    id: 'beacon-logger',
    requiredConsent: 'analytics',
    defer: 'idle',
    consent({ consent, debug }) {
      if (debug) console.debug('[beacon-logger] consent', consent)
    },
    page(page, { emitError }) {
      if (!send({ type: 'page', ...page })) {
        emitError({ scope: 'provider-page', message: 'sendBeacon refused the page view' })
      }
    },
    track(event, { identity }) {
      send({ type: 'track', id: event.id, name: event.name, params: event.params, userId: identity.userId })
    },
  })
}
```

Register it like any built-in provider:

```ts
const analytics = createAnalytics({
  providers: [beaconLogger('/api/log')],
})
```

It has no `load`, because there's no script to fetch: `defer: 'idle'` still
holds its events in the backlog until the browser is idle. It has no
`teardown` either: beacons set no cookies, and the manager stops calling
`page` and `track` as soon as analytics is withdrawn.

For events that must reach your server even when no browser plugin is
active, use [server-side tracking](/guides/server-side-tracking/) instead.
