---
title: Consent adapters
description: "Adapters connect ConsentLayer to other consent systems: IAB TCF, Shopify Customer Privacy and Google Consent Mode."
---

A consent adapter connects ConsentLayer to another system that holds or reads
consent. Providers sit above ConsentLayer and follow the visitor's choice;
adapters sit beside it and keep that choice in step with the other system:
reading it from a CMP, writing it to Shopify, or signalling it to Google tags.

Adapters are passed to `createAnalytics({ consent: { adapters } })`, not to
`providers`:

```ts
import { googleConsentMode } from 'consentlayer/adapters/google-consent-mode'
import { createTcfAdapter } from 'consentlayer/adapters/tcf'

createAnalytics({
  providers,
  consent: { adapters: [createTcfAdapter(), googleConsentMode()] },
})
```

## Available adapters

Each adapter is a named export of its own entry point,
`consentlayer/adapters/<name>`.

| Adapter | Factory | Reads the choice | Writes the choice |
|---|---|---|---|
| [IAB TCF](/guides/adapters/tcf/) | `createTcfAdapter()` | From the TCF CMP | No |
| [Shopify Customer Privacy](/guides/adapters/shopify/) | `createShopifyCustomerPrivacyAdapter()` | From Shopify | To Shopify |
| [Google Consent Mode](/guides/adapters/google-consent-mode/) | `googleConsentMode()` | No | To Google tags, as Consent Mode signals |

## Order

A choice stored by ConsentLayer wins. Without one, the adapters that read a
choice are asked in the order you pass them, and the first that has one
provides it. Later changes made in an adapter's system flow back into
ConsentLayer, and every choice made through ConsentLayer is written to the
adapters that write. [Consent](/internals/consent/#adapters) describes each
step, and how to write your own adapter.
