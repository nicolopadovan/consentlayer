---
title: Writing a plugin
description: The plugin contract, what each hook receives and when, and what the manager guarantees around it.
sidebar:
  order: 5
---

Every built-in provider is a plain object that the analytics manager drives
through hooks. A plugin of your own uses the same contract and gets the same
consent handling, queueing and error isolation. This page defines the
contract; [Lifecycle](/internals/lifecycle/) describes the passes that call
each hook. The types are in `src/core/types.ts` and the manager in
`src/core/analytics-manager.ts`.

## The contract

`definePlugin(plugin)` from `consentlayer` returns its argument unchanged. It
exists so TypeScript checks the object against `AnalyticsPlugin`.

```ts
type LoadTiming = false | 'idle' | 'interaction' | number

type Hook<Args extends unknown[] = []> = (...args: [...Args, PluginContext]) => Promise<void> | void

interface AnalyticsPlugin {
  id: string
  requiredConsent: keyof ConsentState | 'none' | ((consent: ConsentState | null) => boolean)
  loadBeforeConsent?: boolean
  defer?: LoadTiming
  setup?: Hook
  load?: Hook
  consent?: Hook
  page?: Hook<[page: PageEvent]>
  track?: Hook<[event: AnalyticsEventPayload]>
  identify?: Hook<[identity: UserIdentity, traits: UserTraits]>
  reset?: Hook
  group?: Hook<[groupId: string, traits: Record<string, unknown>]>
  error?: Hook<[error: unknown, context: ErrorContext]>
  teardown?: Hook
}
```

| Field               | Meaning                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                | Unique per instance. It is the key for `only`, `activeProviders` and the `providerId` passed to `onError`. Registering a different object with an `id` already in use keeps the first and reports a `provider-setup` error; registering the same object again does nothing.                                                                                  |
| `requiredConsent`   | Required, with no default; a plugin without it never runs. `'none'`: the plugin is active from boot, before the visitor chooses. A category name (`preferences`, `analytics`, `marketing`, a custom category or `sale_of_data`) requires that category to be `true`. A function is called only once consent is known; before that the plugin is not allowed. |
| `loadBeforeConsent` | Run `load` at boot even if the plugin is not yet allowed. It still receives no events until it is.                                                                                                                                                                                                                                                           |
| `defer`             | Delay `load` by a number of milliseconds, until the browser is idle (`'idle'`, with a 5 second cap), or until the first `pointerdown`, `keydown`, `scroll` or `touchstart` (`'interaction'`). Outside the browser it is due at once.                                                                                                                         |
| `events`            | The event names `track` receives: all when unset, none with `false`. An event whose `only` names the plugin is always delivered. Page views are not affected.                                                                                                                                                                                                |

### Hooks

Every hook receives a `PluginContext` as its last argument, built fresh for
each call:

| `ctx` field | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| `consent`   | The current `ConsentState`, or `null` before the visitor has chosen                   |
| `identity`  | `userId`, plus `email` and `phone` only with marketing consent                        |
| `debug`     | Whether the `debug` option is on                                                      |
| `log`       | Logs a message under the `providers` debug topic, attributed to this plugin           |
| `emitError` | Reports an `AnalyticsError` to `onError`; `providerId` defaults to this plugin's `id` |

| Hook       | When it runs                                                                                                                                                                                                                      | Arguments before `ctx`                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `setup`    | Once, whatever the consent: when the instance is created in the browser, or, if `enabled` was false then or the provider was registered later, on the first lifecycle pass after boot. Must not touch the network or set cookies. | none                                                        |
| `consent`  | On every lifecycle pass (boot, each consent change, each registration after boot), whether or not the plugin is allowed, before `load`.                                                                                           | none                                                        |
| `load`     | Once, on the first pass where the plugin is allowed, or at boot with `loadBeforeConsent`; with `defer`, when the timing is due.                                                                                                   | none                                                        |
| `page`     | On `page()` while active.                                                                                                                                                                                                         | `PageEvent`: `url`, `path`, `title`, `id`                   |
| `track`    | On `track()` while active, if the call's `requireAnalyticsConsent` and `requireMarketingConsent` are met.                                                                                                                         | `AnalyticsEventPayload`: `id`, `name`, `params`, `options`  |
| `identify` | On `identify()` while active; once on activation if an identity is known; after a marketing change while the visitor has an email or phone (see below).                                                                           | `identity`, `traits` without `email` and `phone`            |
| `reset`    | On `reset()`, for every plugin whose `setup` has run, active or not.                                                                                                                                                              | none                                                        |
| `group`    | On `group()` while active.                                                                                                                                                                                                        | `groupId`, `traits`                                         |
| `error`    | On `captureError()` and on uncaught errors while active, unless `errors: false`.                                                                                                                                                  | `error`, `ErrorContext`: `level`, `tags`, `extra`, `source` |
| `teardown` | When an active plugin stops being allowed, when it is unregistered, and on `destroy()`.                                                                                                                                           | none                                                        |

<details>
<summary>What a marketing change triggers</summary>

These calls run after the lifecycle pass for the change, and only when the
visitor has an email or phone and marketing consent actually changed:

| Change              | Plugins                                   | Hook                                                                   |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Marketing withdrawn | Active                                    | `identify` with `userId` only, so the SDK can drop the contact details |
| Marketing withdrawn | Set up but not active                     | `reset`                                                                |
| Marketing granted   | Active before the change and still active | `identify` with email and phone                                        |

</details>

`consent` runs before `load` on the first pass, and `teardown` can run
without `load` having run, for example while a deferred `load` is pending. A
plugin that needs both its SDK and the consent should store the context in
`consent` and apply it at the end of `load`; the PostHog and Sentry providers
do this.

`load` is not called again after a teardown. When consent is granted again
the plugin becomes active and receives `consent` and events, so `teardown`
must leave the SDK in a state that `consent` can turn back on.

### Helpers

All three are exported from `consentlayer` and defined in
`src/core/plugin.ts` and `src/core/names.ts`.

| Export                         | What it does                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadScript(src, attributes?)` | Appends `<script async src>` to `<head>` with the given attributes. Resolves on `load`; on `error` removes the element and rejects with `Failed to load <src>`, so a later call retries. |
| `setFlag(name, value)`         | Sets `window.__<prefix><name>`, and the legacy `__acm<name>` when `names.legacy` is on. Returns `value`. Use it to mark one-time global setup.                                           |
| `getFlag(name)`                | Reads that flag, falling back to the legacy name when `names.legacy` is on.                                                                                                              |

<details>
<summary><code>loadScript</code> deduplication</summary>

1. `src` is resolved against `document.baseURI`, so relative and absolute
   forms of the same URL are one script.
2. A call while that URL is still loading returns the same promise.
3. If a `<script>` with that URL is already in the document, the call
   resolves at once, even if that script has not finished loading.
4. Without a `document`, as during server rendering, it resolves at once.

</details>

A `load` hook that throws or rejects is reported with scope `provider-load`.
GA4, GTM, Meta and TikTok catch their `loadScript` failure themselves and
report it with scope `provider-script-load`; Contentsquare and Hotjar ignore
it.

## What the manager guarantees

- **Consent is checked for you.** `page`, `track`, `group` and `error`, and
  `identify` from `identify()`, run only while the plugin is active and its
  `requiredConsent` holds at that moment. `reset` is the exception: it runs
  for every plugin that was set up.
- **Lifecycle passes are serialized.** Each pass runs `setup`, `consent`,
  `load` and `teardown` plugin by plugin, in registration order, and a pass
  starts only after the previous one finished. A deferred `load` joins the
  same queue. Two calls run outside it: `teardown` on unregister and on
  `destroy()`, which is not awaited, and the `identify` and `reset` calls
  after a marketing change.
- **One call, one plugin at a time.** A single `page()`, `track()` or other
  call reaches plugins in registration order, and each plugin's hook is
  awaited before the next plugin gets it. Calls you don't await can
  interleave.
- **Calls before boot wait.** `page`, `track`, `identify`, `group` and
  `captureError` made before `boot()` are queued, up to 100, and delivered in
  order once the first pass has finished.
- **Calls wait for a deferred `load`.** From the pass that schedules `load`
  until it runs, `page`, `track`, `identify`, `reset`, `group` and `error`
  calls for that plugin are held, up to 100, and replayed in order after
  `load` while the plugin is still active. If the plugin is no longer active
  when the timing is due and has no `loadBeforeConsent`, they are discarded and `load` does not run; it is
  scheduled again on the next pass that allows the plugin.
- **Errors stay contained.** A hook that throws or rejects is caught and
  reported with scope `provider-<hook>`; `reset` and `group` use
  `provider-identify`. Other plugins and your app carry on. A full queue is
  reported once with scope `queue-full`.
- **Nothing after `destroy()`.** Once `destroy()` has started each active
  plugin's `teardown`, no further hook runs.
- **Same IDs everywhere.** `page.id` and `event.id` are the IDs the server
  route receives, so a server destination can deduplicate against your
  plugin (see [Server forwarding](/internals/server/)).

The manager does not make your hooks idempotent and does not stop your SDK
from setting cookies; that is the plugin's job.

### Testing a plugin

`checkPlugin(plugin)` from `consentlayer/testing` runs a plugin through a
real manager in a DOM test environment such as jsdom or happy-dom, and
returns the problems it found; an empty array means it passed.

1. Boots with every category denied and calls `page`, `track`, `identify`
   and `group`.
2. Unless `requiredConsent` is `'none'`, reports a script added
   (allowed with `loadBeforeConsent`), a `fetch` request, or a cookie change.
3. Grants every category and repeats the calls, then calls `reset()`, then
   denies every category.
4. Reports every error a hook threw, then destroys the manager and restores
   `fetch`.

```ts
import { checkPlugin } from 'consentlayer/testing'

expect(await checkPlugin(beaconLogger('/api/log'))).toEqual([])
```

It does not detect `sendBeacon`, image pixels or storage writes.

## Example: a beacon logger

This plugin sends page views and events to your own endpoint with
`navigator.sendBeacon`. It requires analytics consent and starts at idle
time.

```ts
import { definePlugin } from 'consentlayer'

export function beaconLogger(endpoint: string) {
  const send = (body: Record<string, unknown>) =>
    navigator.sendBeacon(endpoint, JSON.stringify(body))

  return definePlugin({
    id: 'beacon-logger',
    requiredConsent: 'analytics',
    defer: 'idle',
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

Register it like a built-in provider:

```ts
const analytics = createAnalytics({
  providers: [beaconLogger('/api/log')],
})
```

It has no `load` because there is no script to fetch, yet `defer: 'idle'`
still holds its events until the browser is idle. It has no `teardown`
either: beacons set no cookies, and the manager stops calling `page` and
`track` as soon as analytics is withdrawn.

For events that must reach your server even when no browser plugin is
active, use [server-side tracking](/guides/server-side-tracking/).
