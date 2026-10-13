---
title: Consent
description: How consent is stored, restored, broadcast and synced, step by step.
sidebar:
  order: 2
---

Consent is owned by a small **consent engine** (`core/consent-engine.ts`).
`createAnalytics` builds one, and the analytics manager subscribes to it. The
engine knows nothing about providers: it reads and writes storage, broadcasts
changes, and syncs with outside consent systems through adapters. The manager
reacts to each change by loading, updating or tearing down providers (see
[Lifecycle](/internals/lifecycle/)).

## The shape

```ts
type ConsentState = {
  preferences: boolean
  analytics: boolean
  marketing: boolean
  sale_of_data?: boolean
}
```

Your own [categories](/guides/consent-ui/#custom-categories) sit next to
`preferences`, `analytics` and `marketing` as more booleans.

Every value is coerced to a boolean on the way in (`normalizeConsent`).
`sale_of_data` is kept only if it is a real boolean, otherwise it is dropped.

`null` means **the visitor hasn't chosen yet**. It is not the same as "all
denied": with `null` the banner shows, and only providers whose required
category is `'none'` run. Once a choice is made, consent is never `null` again
in that page: `setConsent` rejects with a `TypeError` unless every category
is a boolean (and `sale_of_data`, if present), so
`null` or `'false'` never slip through. To forget a choice, remove the storage
key and reload.

## Bootstrap: where consent comes from

`analytics.consent.bootstrap()` runs once per engine; later calls get the same
promise back. `<AnalyticsProvider>` calls it on mount. It tries, in order:

| Step | Source | Saved to storage? | Adapters told? |
|---|---|---|---|
| 1 | The value in storage (`localStorage["consentlayer_consent"]`) | no (already there) | no |
| 2 | Each adapter's `bootstrap()`, in the order given; the first non-null result wins | yes | no (the winner is the source) |
| 3 | Nothing found: keep `initialConsent` (or `null`) | no | no |

Before bootstrap finishes, the engine holds `consent.initialConsent` (default
`null`), and the manager starts from that same value. If step 1 or 2 finds a
value equal to the one already held, nothing changes and nothing is broadcast.

With `names: { legacy: true }`, step 1 also reads the old `acm_consent` key: if
the new key is missing, the old value is copied over and the old key deleted.

## Set vs update

| Call | What it commits |
|---|---|
| `consent.setConsent(state)` | `state` exactly; rejects with a `TypeError` if it isn't a valid consent object |
| `consent.update(partial)` | waits for `bootstrap()`, then commits every category denied, overlaid with the current consent and then `partial` |

So `update({ analytics: true })` on a first visit gives
`{ preferences: false, analytics: true, marketing: false }`, and on a visitor
who already granted marketing it keeps marketing on.

## What a change does

Every change goes through one function, `commit`, in this order:

1. **Skip** if the engine was destroyed, the value is `null`, or it equals the
   current value (all three categories and `sale_of_data` compared).
2. **Store** it in memory, then **write** it to storage (except for changes that
   came from storage itself).
3. **Broadcast** it (below).
4. **Notify** subscribers. The analytics manager is one: it starts
   `updateConsent`, which loads, updates or tears down providers. This is not
   awaited, so providers react right away.
5. **Apply** it to every adapter except the one it came from, in parallel.

Adapters run last on purpose. A slow or broken adapter (Shopify not loaded,
a network call hanging) can't delay a withdrawal: by the time adapters start,
the manager is already tearing providers down. An adapter that throws is
reported to `onError` with `scope: 'consent-adapter'`, its `providerId`, and
the message `Consent adapter "<id>" failed to apply consent`; the others still
run.

| Source of the change | Written to storage | Broadcast | Adapters applied |
|---|---|---|---|
| `setConsent` / `update` / the banner | yes | yes | all |
| An adapter's `subscribe` callback | yes | yes | all but that adapter |
| Bootstrap from storage | no | yes | none |
| Bootstrap from an adapter | yes | yes | none |
| Another tab (`storage` event) | no | yes | none |

## Broadcast

Each committed change is published two ways, for code that doesn't hold the
analytics instance (a tag manager, an inline script):

| Channel | Default name | Value |
|---|---|---|
| DOM event on `document` | `consentlayer:consent` | `CustomEvent` with `detail` = the consent |
| Window global | `window.CONSENTLAYER_CONSENT` | the consent object |

With `legacy` on, both are also published under the old names
(`acm:consent`, `window.ACM_CONSENT`). Names follow `names.prefix`; see
[Names](/guides/names/).

```js
document.addEventListener('consentlayer:consent', (event) => {
  if (event.detail.marketing) loadSomething()
})
```

The global is only set once a value is committed, so it is `undefined` until
the first stored, adapter or user choice. `initialConsent` alone is never
broadcast.

### Across tabs

The localStorage storage listens to the browser's `storage` event for its
key. When another tab saves a choice, this tab reads it and commits it: it
broadcasts and notifies the manager, so providers load or stop here too. It
doesn't write it back (it is already stored) and it doesn't call adapters (the
tab that made the choice already did).

## Adapters

An adapter connects the engine to an outside consent system. All three parts
are optional:

```ts
type ConsentIntegrationAdapter = {
  id: string
  bootstrap?(): Promise<ConsentState | null> | ConsentState | null
  apply?(consent: ConsentState): Promise<void> | void
  subscribe?(onConsent: (consent: ConsentState) => void): () => void
}
```

| Part | When it runs | Purpose |
|---|---|---|
| `bootstrap` | during bootstrap, only if storage is empty | read a choice the outside system already has |
| `apply` | after each `setConsent`, `update`, banner choice or other adapter's change | push our choice to the outside system |
| `subscribe` | once, when the engine is created | hear choices made in the outside system |

Pass them with `createAnalytics({ consent: { adapters: [...] } })`.
`destroy()` calls every `subscribe` cleanup. A choice from `subscribe` is
merged into the current consent, so categories the outside system doesn't know
(your own, or `sale_of_data`) keep their value.

### Shopify Customer Privacy

`createShopifyCustomerPrivacyAdapter()` from `consentlayer/providers/shopify`
keeps Shopify's own consent and ours in step.

**Bootstrap.** Unless `loadFeature: false`, it first asks Shopify to load the
`consent-tracking-api` feature (`Shopify.loadFeatures`). Then it reads
`Shopify.customerPrivacy.currentVisitorConsent()`. If every value is empty,
the visitor hasn't chosen, and it returns `null`. Otherwise it maps Shopify's
strings:

| Shopify value | Becomes |
|---|---|
| `'yes'`, `'granted'`, `'allow'`, `'accepted'`, `'true'` | `true` |
| `'no'`, `'denied'`, `'reject'`, `'refused'`, `'false'`, empty or unknown | `false` |

`preferences`, `analytics` and `marketing` map one to one. `sale_of_data` is
included only when Shopify returns a non-empty value; an undecided visitor
leaves it unset. `canBootstrap: () => false`
skips the Shopify read.

**Apply.** Calls `setTrackingConsent({ preferences, analytics, marketing,
sale_of_data? })`. With `headlessStorefront` set, it adds
`headlessStorefront: true` and your `checkoutRootDomain`,
`storefrontRootDomain` and `storefrontAccessToken`, which Shopify needs off its
hosted themes. It does not wait for Shopify's callback.

**Subscribe.** Listens for Shopify's `visitorConsentCollected` DOM event and
maps `marketingAllowed`, `analyticsAllowed`, `preferencesAllowed` and
`saleOfDataAllowed` to our categories. When our own `apply` makes Shopify fire
that event, the value equals ours, so the engine skips it and there is no loop.

## Identity storage

`identify(userId, { email, phone })` keeps an identity in memory and in
`localStorage["consentlayer_user_identity"]`. What is shared and stored
depends on consent:

| Consent | Shared with providers | Stored |
|---|---|---|
| none yet, or analytics and marketing both off | `userId` only, and only to providers allowed to run | nothing (the key is cleared) |
| analytics on, marketing off | `userId` | `{ userId }` |
| marketing on | `userId`, `email`, `phone` | `{ userId, email, phone }` |

Email is trimmed and lowercased and kept only if it looks valid. Phone has
spaces, dashes, dots and brackets removed and is kept only if it is E.164. A
new `userId` replaces the whole identity.

On the next page load, the stored `userId` is used at once. A stored email or
phone is held aside until consent is known: it is used only if marketing is on
and the stored `userId` still matches, and dropped otherwise.

On withdrawal:

- **Marketing off.** Email and phone are removed from memory and storage.
  Active providers are identified again with just `userId`, so they drop the
  contact details. Providers that were set up but are now stopped get
  `reset()`.
- **Analytics and marketing both off.** The storage key is removed.
- **`reset()`** clears memory and storage and calls `reset` on every provider that was set up.

## Reject non-essential

`useConsentController()`'s actions all go through `setConsent`, then hide the
banner and the dialog:

| Action | Commits |
|---|---|
| `acceptAll()` | every category `true` |
| `rejectNonEssential()` | every category `false` |
| `savePreferences()` | the dialog's toggles as set |

"Reject" is a real choice: it is stored, so the banner doesn't come back, and
only providers that need no consent keep running. `sale_of_data` is not set by
these actions; set it yourself with `update({ sale_of_data: false })` if you need it.

## `ready` and the banner

`useConsentController()` exposes `ready`. It is `false` until bootstrap has finished,
then `true` whether bootstrap found a choice, found nothing, or failed. Use it
to avoid flashing UI that depends on consent.

When bootstrap finishes:

| Result | Banner |
|---|---|
| A choice was found | hidden |
| No choice | shown, if `autoShowBanner` (default `true`) |
| Bootstrap threw | shown (if `autoShowBanner`), and `error` is set |

`window.CONSENTLAYER_openConsent()` opens the preferences dialog from anywhere,
for example a "Cookie settings" link in the footer. See
[Consent UI](/guides/consent-ui/).

## When storage fails

Every storage access is wrapped in `try/catch`. If localStorage is blocked
(private mode, a sandboxed iframe, a strict browser setting) or full, reads
return "nothing stored" and writes do nothing. Nothing throws.

The visitor can still choose, and the choice applies for the rest of the page
(it lives in memory and is broadcast as usual). It just isn't remembered, so
the banner appears again on the next page load. The same goes for identity.

To store consent somewhere else (a cookie, your backend), pass
`consent: { storage }` with your own `read`, `write` and optional `subscribe`.
