---
title: Events and identity
description: Track standard events, identify users and read consent.
---

Track everything through the analytics instance: `analytics` from
`createAnalytics()`, or `useAnalytics()` in React. Don't call `gtag`, `fbq` or
other vendor globals yourself. Each provider translates the standard events
into its vendor's format and receives them only while its consent is granted.

## Standard events

Event names follow GA4's naming. Standard events have typed params; any other
name is sent as a custom event.

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

### Ecommerce helpers

Ecommerce events carry GA4's `items[]`. `consentlayer/ecommerce` builds the
params from storefront shapes, with Shopify-style `{ amount, currencyCode }`
prices:

```ts
import { cartParams, orderParams, productParams } from 'consentlayer/ecommerce'

analytics.track('view_item', productParams(product))
analytics.track('add_to_cart', productParams({ ...product, quantity: 2 }))
analytics.track('begin_checkout', cartParams(cart))
analytics.track('purchase', orderParams(order))
```

## What each provider receives

| Standard event | GA4 | Meta | Contentsquare, Hotjar, Vercel |
|---|---|---|---|
| `view_item` | `view_item` | `ViewContent` | unchanged |
| `add_to_cart` | `add_to_cart` | `AddToCart` | unchanged |
| `add_to_wishlist` | `add_to_wishlist` | `AddToWishlist` | unchanged |
| `begin_checkout` | `begin_checkout` | `InitiateCheckout` | unchanged |
| `add_payment_info` | `add_payment_info` | `AddPaymentInfo` | unchanged |
| `purchase` | `purchase` | `Purchase` | unchanged |
| `sign_up` | `sign_up` | `CompleteRegistration` | unchanged |
| `lead` | `generate_lead` | `Lead` | unchanged |
| `search` | `search` | `Search` | unchanged |
| `contact` | `contact` | `Contact` | unchanged |
| `trial_started` | `trial_started` | `StartTrial` | unchanged |
| `subscription_started` | `subscription_started` | `Subscribe` | unchanged |
| `customize_product`, `schedule`, `submit_application`, `find_location`, `donate` | unchanged | `CustomizeProduct`, `Schedule`, `SubmitApplication`, `FindLocation`, `Donate` | unchanged |
| Any other name | unchanged, with characters other than letters, digits and `_` replaced by `_` | a standard event if it is one of Meta's names, otherwise a custom event | unchanged |

Meta also receives `items[]` as `content_ids`, `contents`, `content_type` and
`num_items`, using `item_variant` as the ID when present and `item_id`
otherwise. `search_term` becomes `search_string`. PostHog receives every event
under its original name.

An event reaches a provider only while that provider's consent category is
granted: analytics for GA4, Contentsquare and Hotjar, marketing for Meta.
Vercel Analytics, Sentry and PostHog (in its default cookieless mode) run
without consent; PostHog and Sentry add cookies, replay and user data only
once analytics is granted.
[What each provider receives](/internals/providers/) has the full details.

## Event options

```ts
analytics.track('purchase', params, {
  eventId: order.id,             // shared with the server for deduplication; generated if omitted
  only: ['ga4', 'meta'],         // send to these providers only
  providers: { meta: { content_category: 'shoes' } }, // extra params for one provider
  requireMarketingConsent: true, // drop the event unless marketing is granted
})
```

`requireAnalyticsConsent` works the same way for analytics.

## Identity

```ts
await analytics.identify('user_123', { email: 'ada@example.com', plan: 'pro' })
await analytics.reset() // on logout
```

- **User ID.** Stored locally and passed to every provider that accepts one.
  Identifying a different user replaces what was stored. A provider that
  starts later receives the ID when it starts.
- **Email and phone.** Used only while marketing consent is granted. Until
  then they stay in memory. Once marketing is granted they are stored and sent
  to every provider that accepts them. Withdrawing marketing deletes them and
  clears them from providers that support it.
- **Before boot.** Calls made before `boot()` are held (up to 100) and
  delivered right after it, in order, to the providers consent allows at that
  moment.

| Provider | User ID | Email and phone (with marketing consent) |
|---|---|---|
| GA4 | `user_id` | `user_data`; turn on [user-provided data collection](https://support.google.com/analytics/answer/14077171) in GA4 admin |
| Meta | `external_id` | Advanced matching, only if known when the pixel starts (usually not on a first visit), and on every event sent to the Conversions API |
| PostHog | `identify` | email as a trait |
| Sentry | `setUser` | email |
| Contentsquare | `identify` | not sent |
| Hotjar | `identify` | email as an attribute, when there is a user ID |
| Vercel | not sent | not sent |

### Logging out

`reset()` clears the stored identity and tells each provider that has loaded:
GA4 clears `user_id` and `user_data`, Contentsquare resets its identity and
Hotjar identifies as anonymous.

Two vendors can't fully forget a user mid-page:

- The Meta pixel keeps its advanced-matching data until the next page load.
- Hotjar has no API to remove the email attribute or to log out. It keeps
  linking this browser to the last user until its cookies are cleared, which
  happens when analytics consent is withdrawn.

### Groups

`analytics.group(id, traits)` is passed to providers that support groups,
such as PostHog.

## Consent

```ts
await analytics.consent.update({ analytics: true }) // other categories keep their value
analytics.consent.getConsent()
const unsubscribe = analytics.consent.subscribe(({ consent }) => { … })
```

In React, `useConsent()` returns `{ consent, update, setConsent }` and
re-renders when consent changes. To build a banner, see
[Consent UI](/guides/consent-ui/).
