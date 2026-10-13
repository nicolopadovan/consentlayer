---
title: Lifecycle
description: How the analytics manager drives providers from createAnalytics() to destroy(), hook by hook and in what order.
sidebar:
  order: 1
---

This page follows one ConsentLayer instance from `createAnalytics()` to
`destroy()`: when each provider hook runs, which calls are awaited, how events
are queued before boot and before a deferred SDK loads, and how failures are
isolated. The behaviour described here lives in `createAnalyticsManager`
(`src/core/analytics-manager.ts`). `<AnalyticsProvider>` only decides when to
call `boot()` and when to send page views.

## Creating the instance

`createAnalytics(options)` (`src/core/create-analytics.ts`) is synchronous and
loads nothing. It performs these steps in order:

1. Applies `names` with `configureNames()`, which sets every storage key,
   window global and DOM event name used afterwards (see [Names](/guides/names/)).
2. Validates `server.consentEndpoint`, if set, and throws if it is neither an
   `https:` URL nor a path starting with a single `/`.
3. Creates the consent engine with localStorage storage under
   `<prefix>_consent`, your `consent` options, your `categories`, and the
   consent adapters. If `server.consentEndpoint` is set, a built-in adapter
   with the ID `consent-endpoint` is appended after yours (see
   [Consent](/internals/consent/#adapters)).
4. Creates the manager with localStorage identity storage under
   `<prefix>_user_identity`, subscribes it to the consent engine, and copies
   the engine's current consent (the `initialConsent`, `null` by default).
   `server.endpoint` is validated here with the same rule as step 2.
5. Registers each entry of `providers` as an internal record
   `{ setup: false, loaded: false, active: false }`. No hook runs.
6. Records the instance as the latest one, which hooks such as
   `useAnalytics()` fall back to outside `<AnalyticsProvider>`.

<details>
<summary>Duplicate provider IDs and repeated <code>createAnalytics()</code> calls</summary>

Provider records are keyed by `id`. Registering a different plugin object
under an `id` that is already registered keeps the first one and reports
`Another provider already uses the id "<id>"; this one is ignored` to
`onError` with scope `provider-setup`. Registering the same object again is a
silent no-op.

Names are module-level state. If `createAnalytics()` runs again with a
different `names` value, ConsentLayer logs a `console.warn` and the most
recent names apply to the whole page. Create one instance per page.

</details>

## Boot

`boot()` returns a promise and runs these steps:

1. Returns immediately if the instance was destroyed or has already booted.
2. Sets `booted`.
3. Adds `error` and `unhandledrejection` listeners on `window`, unless
   `errors` is `false` or `errors.globalHandlers` is `false`.
4. Queues a [lifecycle pass](#one-lifecycle-pass) and awaits it.
5. Drains the [pre-boot queue](#before-boot) in order, awaiting each call.
6. Marks the instance ready. From now on calls are delivered immediately.

`<AnalyticsProvider>` calls `analytics.consent.bootstrap()` in one mount
effect and schedules `boot()` in another, according to its `boot` prop:

| `boot.mode` | When `boot()` runs |
|---|---|
| `'immediate'` (default) | In the mount effect. Also the behaviour whenever `window` is undefined. |
| `'idle'` | `requestIdleCallback` with `timeout: boot.timeoutMs ?? 3000`. Without that API, `setTimeout` with `boot.timeoutMs ?? 1500`. |
| `'manual'` | Never. Call `analytics.boot()` yourself. |

Unmounting the provider before an idle boot fires cancels it. The `boot` prop
is read once, on mount.

Consent bootstrap and boot are independent. If bootstrap resolves after
`boot()`, the engine notifies the manager, which queues another lifecycle
pass, so the outcome does not depend on which finishes first. Outside React,
call `analytics.consent.bootstrap()` and then `analytics.boot()` yourself.

## One lifecycle pass

A lifecycle pass (`runLifecycle`) evaluates every provider in registration
order, awaiting each one, then enables [auto-tracking](#auto-tracking) if it
applies, and finally notifies `analytics.subscribe()` listeners with a new
snapshot `{ booted, consent, activeProviders }`. `<AnalyticsProvider>` learns
which providers became active from that notification.

A pass is queued by:

- `boot()`;
- every consent change, through `updateConsent`, which the consent engine
  calls for each committed change;
- `registerProvider()` after boot.

Passes are chained on a single promise (`lifecycleQueue`), so they never
overlap. A consent change that arrives while a provider's `load` hook is
still running waits for it, and a deferred `load` is scheduled onto the same
chain.

For each provider, `evaluateProvider` runs these steps:

1. If the instance has not booted, or `enabled` (a boolean or a function
   evaluated on every pass) is false, tear the provider down and stop.
2. Compute `allowed` from the current consent and the provider's
   `requiredConsent`.
3. On the first pass only, run `setup` and await it.
4. Run `consent` and await it. This happens on every pass, whether or not the
   provider is allowed.
5. If the provider has not been loaded and it is either `allowed` or has
   `loadBeforeConsent`, mark it loaded and run `load`: awaited in place, or
   scheduled for later when the provider has [`defer`](#deferred-loading).
6. If it is not `allowed`, tear it down and stop.
7. If it was already active, stop. Otherwise mark it active and, if an
   identity is known, call `identify` with the identity the provider may
   receive and empty traits.

Tearing down a provider that is not active does nothing. Tearing down an
active provider marks it inactive first and then awaits its `teardown` hook.

A provider therefore always sees `setup`, then `consent`, then `load` at most
once, then events while it is active, then `teardown` when it stops being
allowed. On the first pass `consent` runs before `load`, so a provider must
keep the context it received in `consent` and apply it once its SDK exists.

### `requiredConsent`

| Value | `allowed` when |
|---|---|
| omitted or `'none'` | always, including before the visitor has chosen |
| a category: `'preferences'`, `'analytics'`, `'marketing'`, `'sale_of_data'` or a [custom category](/guides/consent-ui/#custom-categories) | consent is known and that key is `true` |
| a function `(consent) => boolean` | consent is known and the function returns `true` |

Until the visitor has chosen, consent is `null`, and every requirement other
than `'none'` fails without the function being called. Sentry, Vercel
Analytics and PostHog in cookieless mode use `'none'`; GA4, Contentsquare,
Hotjar and PostHog with `cookieless: false` use `'analytics'`; Meta Pixel and
TikTok use `'marketing'`. See [What each provider receives](/internals/providers/).

### `loadBeforeConsent`

With `loadBeforeConsent: true`, `load` runs on the first pass after boot even
though the provider is not allowed. The provider still is not active: it
receives no page views, events or identity until `allowed` becomes true, and
it learns about consent only through its `consent` hook. The GA4 and Meta
Pixel providers expose this as an option, relying on Google Consent Mode and
`fbq('consent', 'revoke')` respectively.

## Deferred loading

A provider's `defer` delays `load` without delaying its activation:

| `defer` | `load` runs |
|---|---|
| `false` or omitted | immediately, inside the lifecycle pass |
| a number | after that many milliseconds (`setTimeout`) |
| `'idle'` | on `requestIdleCallback` with a 5000 ms timeout; `setTimeout(…, 1)` without that API |
| `'interaction'` | on the first `pointerdown`, `keydown`, `scroll` or `touchstart` on `window` |

Outside the browser, the timing resolves immediately.

The sequence is:

1. In the lifecycle pass, `deferLoad` gives the provider an empty backlog and
   starts waiting. The pass does not wait for it, so the provider is marked
   active in the same pass and appears in `activeProviders` immediately.
2. While the backlog exists, every non-lifecycle hook (`page`, `track`,
   `identify`, `reset`, `group`, `error`) is appended to it instead of
   running. Lifecycle hooks (`setup`, `consent`, `load`, `teardown`) are never
   queued.
3. When the timing fires, a job is chained onto `lifecycleQueue`, so it runs
   after any pass in progress. The job removes the backlog and then:
   - if the provider is no longer active and has no `loadBeforeConsent`, it
     discards the backlog and resets `loaded`, so the next grant schedules a
     fresh deferred load;
   - otherwise it awaits `load`, then replays the backlog in order, awaiting
     each call and stopping as soon as the provider is no longer active.

The backlog holds at most 100 calls. Later calls are dropped until `load`
runs, and the first drop is reported to `onError` with scope `queue-full` and
the provider's ID.

## Before boot

Until `boot()` has finished, `page`, `track`, `identify`, `group` and
`captureError` are not delivered. Each call is stored as a deferred delivery
in the `pending` queue, which `boot()` drains in order after its first
lifecycle pass.

| Detail | Behaviour |
|---|---|
| Capacity | 100 calls. The first call beyond that is reported with scope `queue-full`; it and later calls are dropped. |
| Consent check | Performed when the call is delivered, not when it was made, so queued events reach exactly the providers that the first pass activated. |
| `identify()` | Updates and persists the identity immediately; only the provider calls are queued. A flag stops the first pass from also sending the identity on activation, so providers receive it once. |
| `reset()` | Never queued. It runs at once on every provider whose `setup` has run. |
| `enabled` false or destroyed | The call is dropped before it is queued. |

## Delivering an event

`page`, `track`, `identify`, `group` and `captureError` all end in `deliver`:

1. If `server.endpoint` is set, [forward](#server-forwarding) the event. This
   applies to `page` and `track` only and is not awaited.
2. For each provider, in registration order, skip it unless it is active, its
   `requiredConsent` holds for the current consent, and its ID is in `only`
   (when `only` is set).
3. Run the provider's hook and await it before moving to the next provider.

Consent is checked at delivery time. A call that waited in the `pending`
queue is checked when it is drained. A call held in a deferred provider's
backlog was checked when it entered the backlog and is replayed only while the
provider is still active; because a withdrawal tears the provider down on the
same `lifecycleQueue`, a withdrawal before replay stops it. The `track`
options `requireAnalyticsConsent` and `requireMarketingConsent` are evaluated
inside the hook call, so they always use the consent at the moment the hook
would run.

An event for a provider that is not active is dropped, not stored. Only the
`pending` queue and a deferred provider's backlog hold events.

<details>
<summary>Ordering guarantees between calls</summary>

Within one call, providers receive the event one after another and each hook
is awaited. Separate calls are not serialised against each other: if you
call `track()` twice without awaiting, both start immediately, so a provider
whose hook is asynchronous can delay later providers for the first event
while the second event already reaches the first provider. The `pending`
queue and deferred backlogs are replayed strictly in order, one awaited call
at a time.

</details>

### Event IDs and `only`

Every `page` and `track` call carries an ID: `options.eventId` if you pass
one to `track`, otherwise `crypto.randomUUID()`, falling back to a random
base-36 string when Web Crypto is unavailable. The same ID reaches every
provider (`page.id`, `event.id`) and the server, so a browser pixel and its
server-side counterpart can be deduplicated.

`only: ['ga4']` restricts delivery to the listed provider IDs, and the server
handler applies the same list to its destinations. See [Events](/guides/events/).

### Server forwarding

With `server.endpoint` set, `forward` sends `{ ...event, consent, identity }`
as JSON, but only while analytics or marketing consent is granted. The
identity is the full identity with marketing consent and only `userId`
otherwise. The request is a `fetch` POST with `keepalive: true`; where `fetch`
is unavailable, `navigator.sendBeacon` is used. A network error, a non-2xx
response or a refused beacon is reported to `onError` with scope
`server-forward`. The request body and the route are described in
[Server forwarding](/internals/server/).

## Page views

The manager never sends page views on its own; `<AnalyticsProvider>` does. It
tracks which providers have already received a page view for the current
`routeKey` (default `'default'`):

1. After boot, whenever the snapshot or `routeKey` changes, it computes the
   active providers that have not yet received a page view for this key.
2. If there are any, it records them and calls
   `analytics.page(pageProp, { only: fresh })`.
3. A new `routeKey` resets the record and also calls
   `analytics.newPageSession()`.

A provider that becomes active part-way through a visit, for example after
the visitor accepts the banner, therefore receives one page view for the
current page, and providers that already counted it do not receive a
duplicate. Pass a new `routeKey` on every navigation; in the Next.js App
Router that is the pathname plus the search string.

`page()` builds the event from `location.href` (`url`), the pathname plus
search (`path`) and `document.title` (`title`), overlays your payload, and
adds the event ID. The server receives it as a `page_view` event with the same
ID.

## Granting and withdrawing

Both directions run through `updateConsent`, which the consent engine calls
without awaiting it:

1. Records the previous marketing state, whether the identity holds an email
   or phone, and which providers were active.
2. Stores the new consent and adjusts the identity: without marketing consent,
   email and phone are removed from memory. The identity is then persisted or
   cleared (see [Identity storage](/internals/consent/#identity-storage)).
3. Queues a lifecycle pass and awaits it. Providers that became allowed are
   loaded (or scheduled) and activated, and receive the known identity.
   Providers that are no longer allowed are torn down. A torn-down provider
   keeps `loaded`, so a later grant reactivates it without running `load`
   again.
4. If the identity held an email or phone and marketing consent changed:
   - on losing marketing, every active provider receives `identify` with
     only `userId`, and every provider that has run `setup` but is no longer
     active receives `reset`;
   - on gaining marketing, the providers that were active before the change
     receive `identify` with the full identity.

What `teardown` does is up to the provider. Most built-in providers stop
sending and update the vendor's own consent switch; Contentsquare sends its
opt-out command; Hotjar deletes its `_hj` cookies and storage and can reload
the page (`reloadOnRevoke`). See [What each provider receives](/internals/providers/).

## Auto-tracking

At the end of a pass, if the instance has booted, `autoTracking` is set and
the consent the pass evaluated grants analytics, `enableAutoTracking` runs.
It binds once per instance:

| Tracker | Mechanism | Event (default name) |
|---|---|---|
| Page session | Sent when tracking starts and on each `newPageSession()`, unless `pageViews: false` | `consentlayer.page_session_start` |
| Clicks | One `click` listener on `window`; matches `selectors` (mode `'all'`) or the `data-track` attribute (mode `'attribute'`) | `consentlayer.ui_click` |
| Scroll depth | A passive `scroll` listener; thresholds 25, 50, 75 and 100 percent by default, each sent once per page session | `consentlayer.scroll_depth` |
| Time on page | One `setTimeout` per interval; 5, 15, 30, 60 and 120 seconds by default | `consentlayer.time_on_page` |

The listeners stay bound if consent is later withdrawn, but every
auto-tracked event is sent with `requireAnalyticsConsent: true` (and
`autoTracking.only`, if set), so delivery drops it. `newPageSession()` clears
the timers, rebinds the scroll listener and increments the `session_id`
attached to every auto-tracked event.

<details>
<summary>Click names and scroll thresholds</summary>

A click's `ui_target` is the first non-empty value of: the tracking
attribute, `aria-label`, `name`, the first 80 characters of the element's
trimmed text, or `'unknown'`. The event also carries `ui_element` (the
lowercase tag name), `ui_id`, `path` (`location.pathname`) and `session_id`.

The 100 percent threshold fires from 95 percent, because scroll positions
rarely land exactly on the bottom. Thresholds outside `(0, 100]` and
non-finite or non-positive intervals are ignored. The scroll listener removes
itself once every threshold has fired.

</details>

## Errors

No provider error reaches your code or another provider. Every hook runs
inside `call`, which catches synchronous throws and rejected promises and
passes them to `onError` as an `AnalyticsError`
`{ scope, providerId?, message, cause? }`:

| Scope | Source |
|---|---|
| `provider-setup`, `provider-load`, `provider-consent`, `provider-page`, `provider-track`, `provider-error`, `provider-teardown` | That hook threw or rejected. `provider-setup` is also used for a duplicate provider ID. |
| `provider-identify` | `identify`, `reset` or `group` threw or rejected. |
| `provider-script-load` | A provider reported a failed script through `emitError`. |
| `server-forward` | The request to `server.endpoint` failed. |
| `consent-adapter` | A consent adapter's `apply` threw or rejected. |
| `queue-full` | 100 calls were already waiting for boot or for a deferred `load`. |

If `onError` itself throws inside the manager, the exception is swallowed and
logged with `console.debug` when `debug` is on.

`captureError(error, context)` is a separate, intentional path: it delivers
your error to the providers' `error` hooks (Sentry and PostHog), with
`source: 'manual'` unless you pass another. The global listeners call it with
`source: 'global'`; uncaught errors use `level: 'fatal'`, unhandled rejections
no level. With `errors: false`, `captureError` does nothing.

## Destroy

`destroy()` is synchronous and does not wait for teardowns:

1. Starts `teardown` on every active provider without awaiting it.
2. Sets `destroyed`. From then on `boot()` returns at once, no event is
   queued or delivered, no request is forwarded, and `call` refuses to run
   any hook.
3. Unsubscribes from the consent engine.
4. Removes the global error listeners, the auto-tracking click and scroll
   listeners and the time-on-page timers.
5. Forgets all providers and subscribers.

On the instance returned by `createAnalytics()`, `destroy()` also destroys the
consent engine, which runs every storage and adapter `subscribe` cleanup, and
clears the latest-instance reference used by hooks outside
`<AnalyticsProvider>`.

## Example: accept later, PostHog deferred to idle

The setup: `posthog({ apiKey, cookieless: false, defer: 'idle' })`, which
requires analytics consent, the default immediate boot, and a first-time
visitor with nothing stored.

1. `<AnalyticsProvider>` mounts. Bootstrap finds no stored choice, so consent
   stays `null`, and `boot()` runs.
2. The first pass runs PostHog's `setup` (it has none) and `consent`, which
   stores the context. `allowed` is false and there is no
   `loadBeforeConsent`, so nothing loads and the provider stays inactive. The
   `pending` queue is empty.
3. Your code calls `track('pricing_viewed')`. PostHog is not active, so the
   event is dropped. Nothing is forwarded either, because neither analytics
   nor marketing is granted.
4. The visitor accepts analytics. The engine stores the choice, broadcasts it
   and notifies the manager, whose `updateConsent` queues a pass.
5. That pass runs PostHog's `consent` hook, which stores the new context but
   has no SDK to apply it to yet. `allowed` is true, so the provider is marked
   loaded, `deferLoad` gives it an empty backlog and waits for idle time, and
   the provider is marked active.
6. Subscribers are notified. `<AnalyticsProvider>` sees PostHog among the
   active providers and calls `page(payload, { only: ['posthog'] })`. The
   `page` hook goes into the backlog.
7. You call `track('cta_click')`. It goes into the backlog too.
8. The browser becomes idle, at most 5 seconds later. On the lifecycle queue,
   PostHog's `load` imports `posthog-js`, initialises it opted out, and
   applies the stored context, which opts in. The backlog then replays the
   page view and `cta_click`, in order.
9. From now on, calls reach PostHog's hooks directly.

If the visitor withdraws between steps 5 and 8, the withdrawal's pass tears
PostHog down, step 8 discards the backlog instead of loading, and
`posthog-js` is never imported.
