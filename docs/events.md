# Events and Identity

Track through the instance from `createAnalytics()` (or `useAnalytics()` in
React). Never call `gtag`, `fbq` or other provider globals: each provider
translates the standard events itself.

## Standard Events

Names follow GA4's. Their params are typed; any other name is sent as a
custom event.

| Use | Events |
|---|---|
| Any app | `sign_up`, `login`, `search`, `lead`, `share`, `contact` |
| Ecommerce | `view_item`, `view_item_list`, `add_to_cart`, `remove_from_cart`, `add_to_wishlist`, `begin_checkout`, `add_payment_info`, `add_shipping_info`, `purchase`, `refund` |
| SaaS | `trial_started`, `subscription_started`, `subscription_cancelled` |

```ts
analytics.track('sign_up', { method: 'google' })
analytics.track('search', { search_term: 'boots' })
analytics.track('purchase', {
  transaction_id: 'o_123',
  value: 49.9,
  currency: 'EUR',
  items: [{ item_id: 'sku_1', item_name: 'Boots', price: 49.9, quantity: 1 }],
})
```

Ecommerce events carry GA4's `items[]`. `/ecommerce` builds them from
storefront shapes (Shopify-style `{ amount, currencyCode }` prices):

```ts
import { cartParams, orderParams, productParams } from '@nicolopadovan/analytics-consent-manager/ecommerce'

analytics.track('view_item', productParams(product))
analytics.track('add_to_cart', productParams({ ...product, quantity: 2 }))
analytics.track('begin_checkout', cartParams(cart))
analytics.track('purchase', orderParams(order))
```

## How Providers Receive Them

| Standard | GA4 | Meta | Hotjar, Shopify, Vercel |
|---|---|---|---|
| `view_item` | `view_item` | `ViewContent` | as is |
| `add_to_cart` | `add_to_cart` | `AddToCart` | as is |
| `add_to_wishlist` | `add_to_wishlist` | `AddToWishlist` | as is |
| `begin_checkout` | `begin_checkout` | `InitiateCheckout` | as is |
| `add_payment_info` | `add_payment_info` | `AddPaymentInfo` | as is |
| `purchase` | `purchase` | `Purchase` | as is |
| `sign_up` | `sign_up` | `CompleteRegistration` | as is |
| `lead` | `generate_lead` | `Lead` | as is |
| `search` | `search` | `Search` | as is |
| `contact` | `contact` | `Contact` | as is |
| `trial_started` | `trial_started` | `StartTrial` | as is |
| `subscription_started` | `subscription_started` | `Subscribe` | as is |
| `customize_product`, `schedule`, `submit_application`, `find_location`, `donate` | as is | `CustomizeProduct`, `Schedule`, `SubmitApplication`, `FindLocation`, `Donate` | as is |
| anything else | as is, with characters other than letters, digits and `_` replaced by `_` | standard if it is a Meta standard name, else custom | as is |

Meta also receives `items[]` as `content_ids`, `contents`, `content_type` and
`num_items` (IDs are `item_variant`, else `item_id`), and `search_term` as
`search_string`.

An event reaches each provider whose own consent category is granted: GA4 and
Hotjar need analytics, Meta needs marketing.

## Per-Event Options

```ts
analytics.track('purchase', params, {
  eventId: order.id,                        // shared with the server for dedupe; generated if omitted
  only: ['ga4', 'meta'],                    // send to these providers only
  providers: { meta: { content_category: 'shoes' } }, // merged into GA4's or Meta's params
  requireMarketingConsent: true,            // drop unless marketing is granted (also requireAnalyticsConsent)
})
```

## Identity

```ts
await analytics.identify('user_123', { email: 'ada@example.com', plan: 'pro' })
await analytics.reset() // on logout
```

- The user ID, email and phone are stored locally (`npcm_user_identity`) and
  passed to providers. Identifying a different user replaces what was stored.
  A provider that loads later receives the user ID when it starts.
- GA4 gets `user_id` only. Hotjar gets the user ID and traits without email
  or phone. Meta's server mirror uses email, phone and the user ID (hashed on
  the server) for matching.
- `reset()` clears the stored identity and tells each provider that has loaded
  (GA4 clears `user_id`, Hotjar identifies as anonymous).
- `group(id, traits)` is passed to providers that support groups.

## Consent

```ts
await analytics.consent.update({ analytics: true })  // other categories keep their value
analytics.consent.getConsent()
analytics.consent.subscribe(({ consent }) => { … })
```

In React, `useConsent()` returns `{ consent, update, setConsent }`.
