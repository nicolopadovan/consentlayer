---
title: Consent
description: How the consent engine stores, restores, broadcasts and syncs consent, and how identity storage follows it.
sidebar:
  order: 2
---

Consent is owned by the consent engine (`src/core/consent-engine.ts`).
`createAnalytics()` creates one engine per instance and subscribes the
analytics manager to it. The engine has no knowledge of providers: it reads
and writes storage, broadcasts each change to the page, and synchronises with
external consent platforms through adapters. The manager reacts to every
change by loading, updating or tearing down providers, as described in
[Lifecycle](/internals/lifecycle/).

## The shape

```ts
type ConsentState = Record<ConsentCategory, boolean> & {
  sale_of_data?: boolean
}

// 'preferences' | 'analytics' | 'marketing', plus every key you declare
type ConsentCategory = keyof ({ preferences: true; analytics: true; marketing: true } & ConsentCategories)
```

[Custom categories](/guides/consent-ui/#custom-categories) are declared in
`ConsentCategories`, passed to `createAnalytics({ categories })`, and stored,
broadcast and sent to the server exactly like the built-in ones.

Every value entering the engine is normalised (`normalizeConsent` in
`src/core/utils.ts`):

| Input | Result |
|---|---|
| A known category | Coerced with `Boolean()`; a missing category becomes `false`. |
| `sale_of_data` | Kept only if it is a real boolean; otherwise removed. |
| Any other key | Removed. |
| `null` or `undefined` | `null`. |

`null` means the visitor has not chosen yet. It is not the same as "all
denied": while consent is `null`, the banner is shown and only providers
whose requirement is `'none'` run. Once a choice is committed, the engine
never returns to `null` during that page load: a `null` commit is ignored, and
`setConsent` rejects with a `TypeError` unless every category is a boolean
and `sale_of_data`, if present, is a boolean too. To forget a choice, remove
the storage key and reload the page.

## Bootstrap: where consent comes from

`analytics.consent.bootstrap()` runs once per engine; later calls return the
same promise. `<AnalyticsProvider>` calls it on mount. It tries these sources in order and stops at the first that yields
a value:

| Step | Source | Written to storage | Broadcast | Adapters applied |
|---|---|---|---|---|
| 1 | The storage adapter, by default `localStorage["consentlayer_consent"]`, unless the choice there is [stale](#stale-choices) | no (already stored) | yes | none |
| 2 | Each adapter's `bootstrap()`, in the order given, awaited one at a time | yes | yes | none |
| 3 | Nothing found: the engine keeps `initialConsent` (default `null`) | no | no | none |

Until bootstrap resolves, the engine holds `consent.initialConsent`, and the
manager starts from the same value. If step 1 or 2 yields a value equal to the
one already held, nothing is written or broadcast. In step 3 the engine still
notifies its subscribers once, with the unchanged consent, so the manager
runs a lifecycle pass. Bootstrap resolves to the resulting consent.

<details>
<summary>Legacy keys and bootstrap failures</summary>

With `names: { legacy: true }`, step 1 also reads the pre-1.0 key
`acm_consent`: if the current key is empty and the legacy key holds a value,
the value is copied to the current key, the legacy key is removed, and the
value is used. The same migration applies to the identity key
(`acm_user_identity`).

An adapter whose `bootstrap()` throws or rejects is reported to `onError`
with scope `consent-adapter`, its `providerId`, and the message
`Consent adapter "<id>" failed to read consent`; the engine then asks the next
adapter, so one failing integration cannot block the others or leave
`bootstrap()` rejected.

</details>

### Stale choices

The storage adapter holds a `StoredConsent` record: the choice, `updatedAt`
(milliseconds since the epoch) and the `policyVersion` it was made under. In
step 1 the record is stale when `consent.maxAgeDays` is set and `updatedAt` is
missing or older than that, or when `consent.policyVersion` is set and the
record's version is missing or has another major version, the part before
the first `.`. A stale record is skipped in step 1
with `onStale: 'discard'`, so the adapters are asked next, and used as usual
with `onStale: 'keep'`. Either way `isStale()` returns `true` until the next
choice is written, and with `debug` the engine logs `stored consent is
stale`.

Every write stores the current time and `consent.policyVersion`. While the
stored choice is stale, a `setConsent()` equal to the current consent is not
ignored: it is written, broadcast and applied to every adapter like a change.

## Set vs update

| Call | What it commits |
|---|---|
| `consent.setConsent(state)` | `state` exactly, after validation. Rejects with a `TypeError` if any category is missing or not a boolean. |
| `consent.update(partial)` | Awaits `bootstrap()`, then commits every category set to `false`, overlaid with the current consent, overlaid with `partial`. |

`update({ analytics: true })` on a first visit therefore commits
`{ preferences: false, analytics: true, marketing: false }`, and on a visitor
who had already granted marketing it keeps marketing granted. Both calls
resolve only after the [adapters](#adapters) have finished applying the
change.

## What a change does

Every change goes through one function, `commit`, which runs these steps in
order:

1. **Skip** the change if the engine was destroyed, the value is `null`, or it
   equals the current value. Equality compares the normalised objects, so it
   covers every category, custom ones included, and `sale_of_data`.
2. **Store** the value in memory and, unless it came from storage itself,
   **write** it to the storage adapter.
3. **Broadcast** it as a DOM event and a window global (see
   [Broadcast](#broadcast)).
4. **Notify** subscribers synchronously. The analytics manager and every
   adapter's `observe` are among them. The analytics manager
   starts `updateConsent` without awaiting it, so providers begin reacting
   before step 5.
5. **Apply** it to every adapter that has an `apply` method, except the
   adapter the change came from, in parallel. `commit` awaits all of them.

Adapters run last by design. A slow or failing adapter, such as a Shopify
script that never loads or a consent endpoint that times out, cannot delay a
withdrawal: by the time adapters start, the manager is already tearing
providers down. An adapter that throws or rejects is reported to `onError`
with scope `consent-adapter`, its `providerId`, and the message
`Consent adapter "<id>" failed to apply consent`; the other adapters still
run.

| Source of the change | Written to storage | Broadcast | Adapters applied |
|---|---|---|---|
| `setConsent`, `update` or a consent UI action | yes | yes | all |
| An adapter's `subscribe` callback | yes | yes | all except that adapter |
| Bootstrap from storage | no | yes | none |
| Bootstrap from an adapter | yes | yes | none |
| Another tab (`storage` event) | no | yes | none |

## Broadcast

Each committed change is published on two channels, for code that does not
hold the analytics instance, such as a tag manager or an inline script:

| Channel | Default name | Value |
|---|---|---|
| DOM event dispatched on `document` | `consentlayer:consent` | `CustomEvent` whose `detail` is the consent |
| Window global | `window.CONSENTLAYER_CONSENT` | The consent object |

With `names.legacy` on, both are also published under the pre-1.0 names
`acm:consent` and `window.ACM_CONSENT`. The names derive from `names.prefix`
(see [Names](/guides/names/)) and can be replaced with `consent.broadcast`.

```js
document.addEventListener('consentlayer:consent', (event) => {
  if (event.detail.marketing) loadSomething()
})
```

The global is set only when a value is committed, so it is `undefined` until
the first stored, adapter or visitor choice. `initialConsent` on its own is
never broadcast.

### Across tabs

The default localStorage storage subscribes to the browser's `storage` event
for its key, which fires only in other tabs. When another tab saves a choice,
this tab reads the key, normalises the choice and commits it with the
"Another tab" behaviour from the table above: it broadcasts and notifies the
manager, so providers load or stop here too, but it neither writes the value
back nor calls adapters, because the originating tab already did both. A
removed, unreadable or stale value is ignored.

## Adapters

An adapter connects the engine to an external consent platform. Every part
except `id` is optional:

```ts
interface ConsentIntegrationAdapter {
  id: string
  bootstrap?(): Promise<ConsentState | null> | ConsentState | null
  apply?(consent: ConsentState): Promise<void> | void
  subscribe?(onConsent: (consent: ConsentState) => void): (() => void) | void
  observe?(consent: ConsentState | null): void
}
```

| Part | When it runs | Purpose |
|---|---|---|
| `bootstrap` | During bootstrap, only if storage holds no value and no earlier adapter returned one | Read a choice the external platform already has |
| `apply` | After every committed change except those from storage, bootstrap, or this adapter's own `subscribe` | Push the choice to the external platform |
| `subscribe` | Once, when the engine is created | Receive choices made in the external platform |
| `observe` | Once when the engine is created, with the current consent (`null` before a choice), then on every notify, whatever the change's source | Mirror the choice somewhere that has no consent of its own, such as Google's Consent Mode signals |

Pass adapters with `createAnalytics({ consent: { adapters: [...] } })`.
An `observe` that throws is reported to `onError` with scope
`consent-adapter` and the message
`Consent adapter "<id>" failed to observe consent`.
`destroy()` calls every cleanup function returned by `subscribe`. A value from
`subscribe` is merged over the current consent before it is normalised, so
categories the external platform does not know, such as your own or
`sale_of_data`, keep their current value.

When `server.consentEndpoint` is set, `createAnalytics()` appends one more
adapter, `consent-endpoint`, after yours. Its `apply` POSTs
`{ consent }` as JSON to the endpoint and throws on a non-2xx response, which
is reported with scope `consent-adapter`. See
[Consent records](/guides/consent-records/).

### Shopify Customer Privacy

`createShopifyCustomerPrivacyAdapter()` from `consentlayer/adapters/shopify`
keeps Shopify's consent state and ConsentLayer's in step. Its adapter ID is
`shopify-customer-privacy`.

| Part | Behaviour |
|---|---|
| `bootstrap` | Returns `null` if `canBootstrap()` returns false. Unless `loadFeature: false`, first loads Shopify's Customer Privacy script when `headlessStorefront.storefrontAccessToken` is set and `Shopify.customerPrivacy` is missing, then awaits `Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }])`. Reads `Shopify.customerPrivacy.currentVisitorConsent()` and returns `null` if it is missing or every value is empty, which means the visitor has not chosen. Otherwise maps the values as below. |
| `apply` | Loads the feature in the same way, then calls `setTrackingConsent({ preferences, analytics, marketing, sale_of_data? })`. With `headlessStorefront.storefrontAccessToken` set, it adds `headlessStorefront: true` and your `checkoutRootDomain`, `storefrontRootDomain` and `storefrontAccessToken`, which Shopify requires outside its hosted themes. It resolves when Shopify calls back, or immediately when `setTrackingConsent` is missing. |
| `subscribe` | Listens for Shopify's `visitorConsentCollected` DOM event and maps `preferencesAllowed`, `analyticsAllowed`, `marketingAllowed` and `saleOfDataAllowed` to the matching categories. |

| Shopify value | Becomes |
|---|---|
| `true`, `'yes'`, `'granted'`, `'allow'`, `'accepted'`, `'true'` (case-insensitive) | `true` |
| `false`, `'no'`, `'denied'`, `'reject'`, `'refused'`, `'false'`, empty or unknown | `false` |

`sale_of_data` is included only when Shopify returns a non-empty value for it,
so an undecided visitor leaves it unset. When ConsentLayer's own `apply`
causes Shopify to fire `visitorConsentCollected` with the same values, the
merged result equals the current consent, `commit` skips it, and no loop
occurs.

### IAB TCF

`createTcfAdapter()` from `consentlayer/adapters/tcf` reads consent from the
IAB TCF v2 CMP on the page. Its adapter ID is `tcf`.

| Part | Behaviour |
|---|---|
| `bootstrap` | Returns `null` if `window.__tcfapi` is missing. Otherwise calls `__tcfapi('addEventListener', 2, callback)`, takes the first callback, removes the listener with `removeEventListener` and its `listenerId`, and returns `null` unless the call succeeded and `gdprApplies` is `true`. Otherwise maps `purpose.consents` as in the [mapping table](/guides/adapters/tcf/#purposes-and-categories), including while the CMP shows its interface (`eventStatus: 'cmpuishown'`), when no purpose has consent yet. |
| `apply` | None. TCF has no command for writing consent back to the CMP. |
| `subscribe` | Adds a listener the same way and maps every callback with `gdprApplies: true`; the others are ignored. The returned function removes the listener, or removes it as soon as the CMP reports its `listenerId` if that has not happened yet. |

### Google Consent Mode

`googleConsentMode()` from `consentlayer/adapters/google-consent-mode` sends
the choice to Google tags. Its adapter ID is `google-consent-mode`, and it has
only `observe`.

| Call | Behaviour |
|---|---|
| First | Creates `window.dataLayer` and `window.gtag` if absent and sets the `__consentlayerGoogleConsentMode` window flag, which tells `ga4()` to skip its own Consent Mode calls. Calls `gtag('consent', 'default', …)` with every signal denied except `security_storage`, then one `default` per `regions` entry, then the `url_passthrough` and `ads_data_redaction` settings that are on. If the consent is not `null`, continues as below. |
| Later | Calls `gtag('consent', 'update', …)` with the [signal mapping](/guides/adapters/google-consent-mode/#signals). While consent is `null` and no update was sent yet, nothing is sent, so the defaults stay in force. |

## Identity storage

`identify(userId, { email, phone })` keeps an identity in memory and persists
part of it to `localStorage["consentlayer_user_identity"]`. What is shared
with providers and what is persisted depends on consent:

| Consent | Shared with providers | Persisted |
|---|---|---|
| Not chosen yet, or analytics and marketing both denied | `userId` only, and only with providers allowed to run | nothing; the key is removed |
| Analytics granted, marketing denied | `userId` | `{ userId }` |
| Marketing granted | `userId`, `email`, `phone` | `{ userId, email, phone }` |

The identity is normalised on the way in (`normalizeIdentity` in
`src/core/utils.ts`):

| Field | Normalisation |
|---|---|
| `email` | Trimmed and lowercased; kept only if it has the form `name@domain.tld` with no whitespace. |
| `phone` | Spaces, dashes, dots and parentheses removed; kept only if it is an E.164 number, with or without the leading `+`. |
| `userId` | Converted to a string. A `userId` different from the current one replaces the whole identity, so a previous visitor's contact details are not carried over. |

On the next page load, the stored `userId` is used immediately. A stored
email or phone is held aside until consent is known, then used only if
marketing is granted and the current `userId` still matches the stored one;
otherwise it is discarded.

On a consent change:

| Change | Effect on identity |
|---|---|
| Marketing withdrawn | Email and phone are removed from memory and storage. If they were set, active providers receive `identify` again with only `userId`, and providers that have run `setup` but are now inactive receive `reset`. |
| Marketing granted | If an email or phone is held in memory, the providers that were already active receive `identify` with the full identity. Newly activated providers receive it on activation. |
| Analytics and marketing both denied | The storage key is removed. |

`analytics.reset()` clears the identity from memory and storage and calls
`reset` on every provider whose `setup` has run, whatever the consent.

## Reject non-essential

`useConsentController()`'s actions all call `setConsent`, await it, and then
hide both the banner and the preferences dialog:

| Action | Commits |
|---|---|
| `acceptAll()` | Every category in `analytics.consent.categories` set to `true` |
| `rejectNonEssential()` | Every category set to `false` |
| `savePreferences()` | The dialog's toggles (`prefs`) as set |

Rejecting is a real choice: it is stored, so the banner does not return, and
only providers that need no consent keep running. None of these actions sets
`sale_of_data`, and because `setConsent` commits exactly what it receives, a
previously stored `sale_of_data` value is dropped. Set it with
`update({ sale_of_data: false })` if you need it.

## `ready` and the banner

`useConsentController()` exposes `ready`, which is `false` until bootstrap
settles and `true` afterwards, whether bootstrap found a choice, found
nothing or failed. Use it to avoid rendering consent-dependent UI before the
stored choice is known.

When bootstrap settles:

| Result | Banner | Dialog toggles |
|---|---|---|
| A choice was found | hidden | set from the choice |
| A stale choice was kept (`onStale: 'keep'`) | shown if `autoShowBanner` | set from the choice |
| No choice | shown if `autoShowBanner` (default `true`) | all `false` |
| Bootstrap rejected | shown if `autoShowBanner`; `error` holds the message | all `false` |

The toggles also follow every later consent change. `<AnalyticsProvider>`
defines `window.CONSENTLAYER_openConsent()` (or the name passed as
`openConsentGlobalKey`), which opens the preferences dialog from anywhere,
such as a "Cookie settings" link in the footer. See
[Consent UI](/guides/consent-ui/).

## When storage fails

Every access to the default localStorage storage is wrapped in `try/catch`
(`src/core/storage.ts`). If localStorage is blocked, as in a sandboxed iframe
or with all cookies blocked, or if the quota is full, reads return "nothing
stored" and writes do nothing. No error is thrown or reported.

The visitor can still choose, and the choice applies for the rest of the page
load: it is held in memory and broadcast as usual. It is not remembered, so
the banner appears again on the next page load. Identity behaves the same
way.

To keep consent elsewhere, such as in a cookie or your backend, pass
`consent: { storage }` with your own `ConsentStorageAdapter`: synchronous
`read()` and `write(record)` of a `StoredConsent`, plus optional `subscribe(listener)` for
external changes and `clear()`. `createMemoryConsentStorage()` keeps consent
in memory only.
