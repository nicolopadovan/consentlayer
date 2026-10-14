---
title: IAB TCF
description: "createTcfAdapter() reads the visitor's choice from an IAB TCF v2 CMP already on the page."
---

`createTcfAdapter()` reads the visitor's choice from a Consent Management
Platform (CMP) that implements the
[IAB Transparency and Consent Framework](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework)
v2 and is already on the page. It talks to the CMP through the standard
`window.__tcfapi` function, maps the consent the visitor gave to TCF purposes
onto ConsentLayer's categories, and follows every change the CMP reports.

```ts
import { createTcfAdapter } from 'consentlayer/providers/tcf'

createAnalytics({
  providers,
  consent: { adapters: [createTcfAdapter()] },
})
```

The CMP is required. ConsentLayer does not show a TCF consent dialog, does not
write a TC string and is not a registered CMP: the adapter only reads what the
CMP decided.

## The CMP owns the choice

The adapter is read-only. The TCF CMP API has no command for writing consent
back, so the adapter has no `apply` method, and a choice made through
ConsentLayer, such as `analytics.consent.update()` or a settings dialog built
on [`useConsentController()`](/guides/consent-ui/), never reaches the CMP. The
CMP's next update overwrites it.

Visitors change their choice in the CMP's own interface. Link to the CMP's
settings, not to ConsentLayer's, and don't render ConsentLayer's banner where
the CMP shows its own. While the CMP reports that GDPR applies, the adapter
always provides a choice, so `bannerVisible` stays `false` there.

## Purposes and categories

A category is granted when the visitor consented to every purpose mapped to
it, that is when `tcData.purpose.consents[id]` is `true` for each `id`.

| Category | TCF purposes |
|---|---|
| `preferences` | 1 (Store and/or access information on a device) |
| `analytics` | 1, 8 (Measure content performance) |
| `marketing` | 1, 2 (Use limited data to select advertising), 3 (Create profiles for personalised advertising), 4 (Use profiles to select personalised advertising), 7 (Measure advertising performance) |

Only consent counts. A purpose the CMP reports under legitimate interest, in
`tcData.purpose.legitimateInterests`, does not grant a category.

The `purposes` option changes the mapping. It is merged over the defaults one
category at a time, so you name only the categories you change. A
[custom category](/guides/consent-ui/#custom-categories) is granted only if
`purposes` maps it; a category mapped to an empty list is never granted.

```ts
createTcfAdapter({
  purposes: { analytics: [1, 8, 9], functional: [1, 5, 6] },
})
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `purposes` | `Partial<Record<ConsentCategory, number[]>>` | The table above | TCF purpose IDs per category, merged over the defaults. |
| `window` | `Window` | The global `window` | The window that holds `__tcfapi`. |

## When there is no TCF choice

The adapter returns `null` from bootstrap, which leaves the visitor to
ConsentLayer's own banner, in two cases:

- **No CMP.** `window.__tcfapi` is not defined when the instance bootstraps.
- **GDPR does not apply.** The CMP reports `gdprApplies: false`, typically for
  a visitor outside the EU. Updates with `gdprApplies` other than `true` are
  ignored too, so a choice made in ConsentLayer's banner is kept.

To serve both groups, render ConsentLayer's banner as usual: it shows only
when the adapter returned `null` and no choice is stored.

<details>
<summary>While the CMP shows its interface</summary>

On a first visit the CMP reports `eventStatus: 'cmpuishown'` before the
visitor has chosen. Its TC data then has no purpose consents, so the adapter
returns every category denied. From ConsentLayer's side that is a choice:
`ready` becomes `true`, `bannerVisible` stays `false`, providers that need no
consent boot, and the others wait. When the visitor confirms in the CMP, it
reports `eventStatus: 'useractioncomplete'`, and the adapter's subscription
applies the new consent.

The denied state is stored like any other adapter choice. On the next visit
ConsentLayer reads the stored choice first and skips the adapter's bootstrap,
but the subscription still receives the CMP's current data as soon as it
registers, since a TCF CMP calls a new listener immediately.

</details>

<details>
<summary>How the adapter talks to the CMP</summary>

Both bootstrap and the subscription call
`__tcfapi('addEventListener', 2, callback)`. Bootstrap takes the first
callback and then removes its listener with
`__tcfapi('removeEventListener', 2, callback, listenerId)`. The subscription
maps every callback until the instance is destroyed, then removes its
listener the same way. A callback with `success: false` counts as no choice.

If the page has the CMP's `__tcfapi` stub but the CMP itself never loads, for
example because a content blocker stops it, the stub queues the call and
bootstrap waits: `ready` stays `false` until the CMP answers.

</details>
