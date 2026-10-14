---
title: Shopify Customer Privacy
description: "createShopifyCustomerPrivacyAdapter() keeps ConsentLayer and Shopify’s Customer Privacy API in agreement."
---

`createShopifyCustomerPrivacyAdapter()` keeps the instance and Shopify's
Customer Privacy API in agreement. When no choice is stored locally, it reads
the visitor's existing choice from `Shopify.customerPrivacy.currentVisitorConsent()`
at bootstrap. Every choice made through ConsentLayer is written to Shopify with
`setTrackingConsent()`, and Shopify's `visitorConsentCollected` DOM event is
applied back to the instance. The optional `sale_of_data` flag is passed
through in both directions.

```ts
import { createShopifyCustomerPrivacyAdapter } from 'consentlayer/providers/shopify'

createAnalytics({
  providers,
  consent: {
    adapters: [
      createShopifyCustomerPrivacyAdapter({
        headlessStorefront: { storefrontAccessToken: process.env.NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN },
      }),
    ],
  },
})
```

On a Shopify-hosted theme the token is unset and `headlessStorefront` is
ignored; on a headless storefront it is set and the headless options apply.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `loadFeature` | `boolean` | `true` | Before reading or writing consent, loads Shopify's Customer Privacy script on a headless storefront (when `storefrontAccessToken` is set and `Shopify.customerPrivacy` is missing), then calls `Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }])` when available. `false` skips both. |
| `headlessStorefront` | `{ checkoutRootDomain?, storefrontRootDomain?, storefrontAccessToken? }` | None | Required off Shopify-hosted themes. Applies only once `storefrontAccessToken` is set, so you can pass the environment variable directly; then passed to `setTrackingConsent` with `headlessStorefront: true`. |
| `canBootstrap` | `() => boolean` | None | Returning `false` skips reading Shopify's existing choice at bootstrap. |
| `document` | `Document` | The global `document` | The document to listen on. |
| `window` | `Window` | The global `window` | The window that holds `Shopify`. |

Shopify reports consent as strings. `granted`, `allow`, `accepted`, `yes` and
`true` (case-insensitive) map to `true`; any other value maps to `false`. If
Shopify reports no value for any category, the visitor is treated as not
having chosen yet.

On a headless storefront the adapter loads Shopify's script from
`cdn.shopify.com` itself. Its URL is also returned by
`getShopifyCustomerPrivacyScriptUrl()`, exported from the same entry point,
for a Content Security Policy or a preload hint.
