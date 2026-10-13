---
title: Lifecycle
description: What the manager does from createAnalytics() to destroy(), hook by hook and in what order.
sidebar:
  order: 1
---

This page follows one analytics instance from `createAnalytics()` to
`destroy()`. Everything here lives in `createAnalyticsManager`
(`src/core/analytics-manager.ts`); the React provider only decides when to
call `boot()` and when to send page views.

## Creating the instance

`createAnalytics()` does three things and nothing else:

1. applies `names` (the defaults if you passed none) and remembers the
   instance for hooks used outside `<AnalyticsProvider>`;
2. creates the consent engine, which reads and writes consent in
   `localStorage` and broadcasts every change as a DOM event and a window
   global;
3. creates the manager, with identity stored in `localStorage`.

No provider runs yet. Each provider in `providers` gets an internal record
`{ setup: false, loaded: false, active: false }`, and that is all. A second
provider with an `id` already in use is ignored and reported to `onError`
(scope `provider-setup`).

## Boot

`boot()` sets `booted`, adds the global `error` and `unhandledrejection`
listeners (unless `errors` is `false` or `errors.globalHandlers` is `false`),
runs the first lifecycle pass, then replays the calls that arrived before boot
(see [Before boot](#before-boot)). Calling it again, or after `destroy()`,
does nothing.

`<AnalyticsProvider>` calls `analytics.consent.bootstrap()` on mount, then
boots according to its `boot` prop (`scheduleBoot`):

| `boot.mode` | When `boot()` runs |
| --- | --- |
| `'immediate'` (default) | In the mount effect. Also always on the server. |
| `'idle'` | `requestIdleCallback` with `timeout: boot.timeoutMs ?? 3000`. Without that API, `setTimeout(boot.timeoutMs ?? 1500)`. |
| `'manual'` | Never. You call `analytics.boot()` yourself. |

Unmounting the provider before an idle boot fires cancels it.

Consent bootstrap and boot are independent. Bootstrap reads stored consent
(or asks a CMP adapter); if it finishes after boot, the resulting consent
change triggers another lifecycle pass, so the order doesn't matter.

## One lifecycle pass

A pass (`runLifecycle`) runs `evaluateProvider` for every provider in
registration order, turns on auto-tracking if it should, and notifies
subscribers (that is how `<AnalyticsProvider>` learns which providers are
active).

A pass is queued on boot, on every consent change (`updateConsent`, which the
consent engine calls) and when a provider is registered after boot. Passes
are chained on one promise, `lifecycleQueue`, so they never overlap: a
consent change that arrives while GA4's `load` is still running waits for it.

`evaluateProvider` does this for one provider:

1. If the instance isn't booted or `enabled` is false: tear it down and stop.
2. Work out `allowed` with `hasRequiredConsent(consent, requiredConsent)`.
3. First pass only: run `setup`.
4. Run `consent`, every pass.
5. If not loaded yet and (`allowed` or `loadBeforeConsent`): mark it loaded
   and run `load`, now or deferred (see [Deferred loading](#deferred-loading)).
6. If not `allowed`: tear it down and stop.
7. If it wasn't active: mark it active, and if an identity is known, call
   `identify` with it.

So the hook order a provider sees is always `setup`, then `consent`, then
`load` (at most once), then events while active, then `teardown` when consent
goes away. `consent` runs before `load` on the first pass, so a provider must
remember the context it got there and apply it once its SDK exists.

### `requiredConsent`

| Value | `allowed` when |
| --- | --- |
| omitted or `'none'` | always, even before the visitor has chosen |
| `'preferences'`, `'analytics'`, `'marketing'` or a [custom category](/guides/consent-ui/#custom-categories) | that category is `true` |
| a function `(consent) => boolean` | it returns `true`; it is only called once consent is known |

With no stored choice, consent is `null`, and every requirement other than
`'none'` fails. Sentry, Vercel and cookieless PostHog use `'none'`; GA4 and
Hotjar use `'analytics'`; Meta Pixel and TikTok use `'marketing'`. See
[Providers](/guides/providers/).

### `loadBeforeConsent`

`loadBeforeConsent: true` runs `load` before consent is granted, but the
provider still isn't active: it gets no page views, events or identity until
`allowed` becomes true. GA4's `loadBeforeConsent` option sets it: gtag.js
loads at boot with Consent Mode denied and is updated through the `consent`
hook.

## Deferred loading

`defer` delays `load` without delaying anything else:

| `defer` | `load` runs |
| --- | --- |
| `false` or omitted | right away, inside the pass |
| a number | after that many milliseconds (`setTimeout`) |
| `'idle'` | on `requestIdleCallback` with a 5000 ms timeout; `setTimeout(1)` without that API |
| `'interaction'` | on the first `pointerdown`, `keydown`, `scroll` or `touchstart` on `window` |

`deferLoad` gives the provider a backlog, an empty array. The provider is
still marked active in the same pass, so it shows up in `activeProviders`
straight away. From then on, every non-lifecycle hook (`page`, `track`,
`identify`, `reset`, `group`, `error`) is pushed onto the backlog instead of
running. Lifecycle hooks (`setup`, `consent`, `load`, `teardown`) are never
queued.

When the timing fires, a job goes onto `lifecycleQueue`:

- If the provider was withdrawn in the meantime (not active, no
  `loadBeforeConsent`), the backlog is discarded and `loaded` is reset, so
  the next grant schedules a fresh deferred load.
- Otherwise `load` runs, then the backlog replays in order, stopping if the
  provider stops being active.

The backlog holds at most 100 calls; later ones are dropped until `load` runs,
and the first drop is reported to `onError` with scope `queue-full`.

## Before boot

Calls to `page`, `track`, `identify`, `group` and `captureError` before
`boot()` has finished go into a `pending` queue (at most 100 entries; the first
call past that is reported with scope `queue-full`), which
`boot()` drains in order after its first pass. That pass sees real consent,
so pending events reach exactly the providers that turned out to be allowed.

`identify` before boot also sets a flag so the first pass doesn't send
identity a second time when it activates providers.

## Delivering an event

`page`, `track`, `identify`, `group` and `captureError` all end in `deliver`:

1. If a server endpoint is configured, forward the event (see below).
2. For each provider, in registration order: skip it unless it is active,
   its `requiredConsent` still holds right now, and it is in `only` (when
   `only` is set). Then run the hook and wait for it before the next
   provider.

Consent is checked at delivery time, not when the call was made. An event that
sat in `pending` or a backlog is checked again when it finally runs, so a
withdrawal in between stops it. `track` options `requireAnalyticsConsent` and
`requireMarketingConsent` are also checked then.

An event for a provider that isn't active is dropped, not saved for later.
Only the `pending` queue (before boot) and a deferred provider's backlog hold
events.

### Event IDs and `only`

Every `page` and `track` call gets an ID: `options.eventId` if you pass one,
otherwise `crypto.randomUUID()` (with a `Math.random` fallback). The same ID
goes to every provider and to the server, so a browser pixel and its
server-side counterpart can be deduplicated.

`only: ['ga4']` limits delivery to those provider IDs, and the server handler
applies the same list to its destinations. See [Events](/guides/events/).

### Server forwarding

With `server.endpoint` set, `forward` POSTs
`{ ...event, consent, identity }` as JSON with `keepalive` (or
`navigator.sendBeacon` without `fetch`), only when analytics or marketing is
granted. Identity is the full identity with marketing consent, otherwise just
`userId`. Failures go to `onError` with scope `server-forward`. See
[Server-side tracking](/guides/server-side-tracking/).

## Page views

`<AnalyticsProvider>` sends page views, not the manager. It remembers which
providers already got a page view for the current `routeKey` (default
`'default'`). Whenever the set of active providers changes, it calls
`page(payload, { only: fresh })` for the active providers that haven't had
one yet. A new `routeKey` starts over.

So a provider that becomes active halfway through a visit, after the visitor
accepts, gets one page view for the page they're on, and providers that
already counted it don't get a duplicate. Pass a new `routeKey` on every
navigation; in Next.js that's the pathname plus search.

`page()` fills `url` (`location.href`), `path` (pathname plus search) and
`title` from the window, then your payload on top. The server receives it as a
`page_view` event with the same ID.

## Granting and withdrawing

Granting runs a pass: allowed providers are loaded (or scheduled) and
activated, the known identity is sent to them, and page views follow from the
React provider.

Withdrawing runs a pass too. A provider that is no longer `allowed` is torn
down: marked inactive first, then its `teardown` hook runs. It stays loaded,
so a later grant reactivates it without loading the script again. What
`teardown` actually does is up to the provider. Most stop sending and delete
their cookies; Hotjar can't be stopped once its script runs, so it deletes its
`_hj` cookies and storage and can reload the page (`reloadOnRevoke`).

Marketing consent also controls identity. Without it, providers get only
`userId`; email and phone are kept off. When marketing changes and the visitor
has an email or phone, active providers get `identify` again with the new
identity. On losing marketing, providers that were set up but are no longer
active get `reset` instead.

## Auto-tracking

After a pass where the instance is booted, `autoTracking` is set and analytics
is granted, `enableAutoTracking` binds the click, scroll and time-on-page
listeners once. They stay bound if consent is later withdrawn, but every
auto-tracked event is sent with `requireAnalyticsConsent: true`, so delivery
drops it. `newPageSession()` (called by the React provider on a new
`routeKey`) restarts the scroll and timer state.

## Errors

The manager never lets a provider error reach your code. Every hook runs
inside `call`, which catches the error and passes it to `onError` with a
scope:

| Scope | From |
| --- | --- |
| `provider-setup`, `provider-load`, `provider-consent`, `provider-page`, `provider-track`, `provider-error`, `provider-teardown` | that hook threw |
| `provider-identify` | `identify`, `reset` or `group` threw |
| `provider-script-load` | a provider reported a failed script via `emitError` |
| `server-forward` | the POST to `server.endpoint` failed |
| `consent-adapter` | a CMP adapter failed to apply consent |
| `queue-full` | 100 calls were already waiting for boot or for a deferred `load`; later ones are dropped |

If `onError` itself throws, that is swallowed and logged in debug mode.

`captureError()` is a separate path: it delivers your error to providers'
`error` hook (Sentry, PostHog). The global listeners call it with
`source: 'global'`; uncaught errors arrive with `level: 'fatal'`.

## Destroy

`destroy()` starts `teardown` on every active provider, then sets `destroyed`,
unsubscribes from the consent engine, removes the global, click and scroll
listeners and the timers, and forgets all providers and subscribers. It
doesn't wait for the teardowns to finish. On the full instance it also
destroys the consent engine.

From then on every method is a no-op: `boot`, `page`, `track` and the rest
return without doing anything, and `call` refuses to run any hook.

## Example: accept later, GA4 deferred to idle

The setup: GA4 with `requiredConsent: 'analytics'` and `defer: 'idle'`, the
default immediate boot, and a first-time visitor.

1. The page renders. `<AnalyticsProvider>` bootstraps consent: nothing is
   stored, so consent is `null`. It calls `boot()`.
2. The first pass runs GA4's `setup` and `consent` (with `consent: null`).
   `allowed` is false and there is no `loadBeforeConsent`, so nothing loads;
   GA4 wasn't active, so `teardown` doesn't run. No `pending` calls to replay.
3. Your code calls `track('pricing_viewed')`. GA4 isn't active, so it is
   dropped. Nothing is forwarded either, because consent isn't granted.
4. The visitor accepts analytics. The engine stores it, broadcasts it and
   calls `updateConsent`, which queues a pass.
5. That pass runs GA4's `consent` hook, sees `allowed`, marks it loaded and
   calls `deferLoad`, which gives it an empty backlog and waits for idle. GA4
   is marked active.
6. Subscribers are notified. `<AnalyticsProvider>` sees GA4 among the active
   providers and calls `page(payload, { only: ['ga4'] })`. The `page` hook
   goes onto the backlog.
7. The visitor clicks a button and you call `track('cta_click')`. That goes
   onto the backlog too.
8. The browser goes idle (at most 5 seconds later). On the lifecycle queue,
   GA4's `load` injects gtag, then the backlog replays: the page view, then
   `cta_click`, each checked against current consent first.
9. From now on, calls go straight to GA4's hooks.

If the visitor had withdrawn between steps 5 and 8, step 8 would discard the
backlog instead of loading, and gtag would never be injected.
