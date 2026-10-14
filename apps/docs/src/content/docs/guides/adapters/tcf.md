---
title: IAB TCF
description: "tcf() reads the visitor's choice from an IAB TCF v2 CMP already on the page."
---

`tcf()` reads the visitor's choice from a Consent Management
Platform (CMP) that implements the
[IAB Transparency and Consent Framework](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework)
v2 and is already on the page. It talks to the CMP through the standard
`window.__tcfapi` function, maps the consent the visitor gave to TCF purposes
onto ConsentLayer's categories, and follows every change the CMP reports.

```ts
import { tcf } from 'consentlayer/adapters/tcf'

createAnalytics({
  providers,
  consent: { adapters: [tcf()] },
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

| Category      | TCF purposes                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preferences` | 1 (Store and/or access information on a device)                                                                                                                                           |
| `analytics`   | 1, 8 (Measure content performance)                                                                                                                                                        |
| `marketing`   | 1, 2 (Use limited data to select advertising), 3 (Create profiles for personalised advertising), 4 (Use profiles to select personalised advertising), 7 (Measure advertising performance) |

Only consent counts. A purpose the CMP reports under legitimate interest, in
`tcData.purpose.legitimateInterests`, does not grant a category.

The `purposes` option changes the mapping. It is merged over the defaults one
category at a time, so you name only the categories you change. A
[custom category](/guides/consent-ui/#custom-categories) is granted only if
`purposes` maps it; a category mapped to an empty list is never granted.

```ts
tcf({
  purposes: { analytics: [1, 8, 9], functional: [1, 5, 6] },
})
```

## Options

| Option     | Type                                         | Default             | Description                                                                                      |
| ---------- | -------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `purposes` | `Partial<Record<ConsentCategory, number[]>>` | The table above     | TCF purpose IDs per category, merged over the defaults.                                          |
| `timeout`  | `number`                                     | `5000`              | Milliseconds bootstrap waits for the CMP before it fails. A negative or non-finite value throws. |
| `window`   | `Window`                                     | The global `window` | The window that holds `__tcfapi`.                                                                |

## When there is no TCF choice

The adapter returns `null` from bootstrap, which leaves the visitor to
ConsentLayer's own banner, in two cases:

- **No CMP.** `window.__tcfapi` is not defined when the instance bootstraps.
- **GDPR does not apply.** The CMP reports `gdprApplies: false`, typically for
  a visitor outside the EU. Updates with `gdprApplies` other than `true` are
  ignored too, so a choice made in ConsentLayer's banner is kept.

In both cases ConsentLayer falls back to the stored choice. To serve both
groups, render ConsentLayer's banner as usual: it shows only when the adapter
returned `null` and no choice is stored.

<details>
<summary>While the CMP shows its interface</summary>

On a first visit the CMP reports `eventStatus: 'cmpuishown'` before the
visitor has chosen. Its TC data then has no purpose consents, so the adapter
returns every category denied. From ConsentLayer's side that is a choice:
`ready` becomes `true`, `bannerVisible` stays `false`, providers that need no
consent boot, and the others wait. When the visitor confirms in the CMP, it
reports `eventStatus: 'useractioncomplete'`, and the adapter's subscription
applies the new consent.

The denied state is stored like any other adapter choice. The adapter is
authoritative, so on the next visit ConsentLayer asks the CMP before it reads
the stored choice, nothing that needs consent boots until the CMP answers, and
the CMP's answer replaces the stored choice.

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
bootstrap waits `timeout` milliseconds. Then it fails with
`The TCF CMP did not answer within <timeout> ms`, reported to `onError` with
scope `consent-adapter`, and ConsentLayer falls back to the stored choice, or
to its own banner when nothing is stored.

</details>

## Limitations

- **Choices made in ConsentLayer are overwritten.** The CMP's next update
  replaces a choice made through ConsentLayer, as described in
  [The CMP owns the choice](#the-cmp-owns-the-choice).
- **A CMP that answers late meets ConsentLayer's banner.** With the CMP's
  `__tcfapi` stub on the page but the CMP slower than `timeout`, ConsentLayer
  falls back to the stored choice or shows its banner, and the CMP may then
  show its own on top. The subscription still applies the CMP's choice once
  it answers. Raise `timeout` if your CMP loads slowly.
- **The denied state from a first visit is stored.** A visitor who leaves
  while the CMP shows its interface has every category denied in
  ConsentLayer's storage. If you later remove the adapter, ConsentLayer reads
  that stored choice and does not show its banner to those visitors until
  the choice becomes stale. Change
  [`policyVersion`](/guides/consent-ui/#asking-again) when you remove the
  adapter, so every visitor is asked again.
- **Tested against the specification, not against named CMPs.** The adapter
  is tested with a simulated `__tcfapi` that follows the IAB CMP API v2, not
  with Usercentrics, OneTrust, Didomi or another CMP.
