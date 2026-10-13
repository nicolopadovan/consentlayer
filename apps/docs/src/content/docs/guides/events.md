---
title: Events and identity
description: Track standard and custom events, scope them with per-event options, identify users and read or change consent from code.
---

This page covers the tracking API of the analytics instance: the standard
events and how each provider translates them, per-event options, user
identity and groups, and reading and changing consent from code. The instance
is the object returned by `createAnalytics()`, or by `useAnalytics()` in React.

Send every event through the instance rather than calling `gtag`, `fbq` or
another vendor global directly. The instance delivers each call only to the
providers whose consent requirement is met at that moment, and each provider
translates the call into its vendor's format. Provider failures never reject
the returned promise; they are reported to the `onError` handler passed to
`createAnalytics()`.

## Standard events

`analytics.track(name, params?, options?)` accepts any event name. Names
follow GA4's conventions. The names below are declared in the
`StandardEvents` interface, so their params are type-checked; any other name
is sent as a custom event with free-form params (`Record<string, unknown>`).
Standard events also accept additional params beyond their declared ones.

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

<details>
<summary>Parameter types of the standard events</summary>

`search_term` on `search` and `transaction_id` on `purchase` and `refund` are
required; every other param is optional.

```ts
type Money = { value?: number; currency?: string }
type EcommerceParams = Money & { items?: EcommerceItem[] }

type EcommerceItem = {
  item_id: string
  item_name?: string
  item_variant?: string
  item_brand?: string
  item_category?: string
  price?: number
  quantity?: number
  discount?: number
  coupon?: string
}

interface StandardEvents {
  sign_up: { method?: string }
  login: { method?: string }
  search: { search_term: string }
  lead: Money
  share: { method?: string; content_type?: string; item_id?: string }
  contact: { method?: string }
  view_item: EcommerceParams
  view_item_list: EcommerceParams & { item_list_id?: string; item_list_name?: string }
  add_to_cart: EcommerceParams
  remove_from_cart: EcommerceParams
  add_to_wishlist: EcommerceParams
  begin_checkout: EcommerceParams & { coupon?: string }
  add_payment_info: EcommerceParams & { payment_type?: string }
  add_shipping_info: EcommerceParams & { shipping_tier?: string }
  purchase: EcommerceParams & { transaction_id: string; tax?: number; shipping?: number; coupon?: string }
  refund: EcommerceParams & { transaction_id: string }
  trial_started: Money & { plan?: string }
  subscription_started: Money & { plan?: string }
  subscription_cancelled: { plan?: string; reason?: string }
}
```

</details>

### Ecommerce helpers

Ecommerce events carry GA4's `items[]` array. `consentlayer/ecommerce` builds
these params from the product, cart and order shapes most storefront APIs
return, with Shopify-style `{ amount, currencyCode }` prices.

```ts
import { cartParams, orderParams, productParams } from 'consentlayer/ecommerce'

analytics.track('view_item', productParams(product))
analytics.track('add_to_cart', productParams({ ...product, quantity: 2 }))
analytics.track('begin_checkout', cartParams(cart))
analytics.track('purchase', orderParams(order))
```

| Helper | For | `value` | `currency` |
|---|---|---|---|
| `productParams(product)` | `view_item`, `add_to_cart`, `remove_from_cart`, `add_to_wishlist` | `price.amount` × `quantity` (quantity defaults to 1); omitted without a price | `price.currencyCode` |
| `cartParams(cart)` | `begin_checkout`, `add_payment_info`, `add_shipping_info` | `subtotal.amount`, or the sum of price × quantity over the lines | `subtotal.currencyCode`, else the first line's |
| `orderParams(order)` | `purchase` | `order.value` | `order.currency` |

`orderParams` also maps `orderId` to `transaction_id` and passes `tax`,
`shipping` and `coupon` through.

<details>
<summary>Input types and the item mapping</summary>

```ts
type MoneyLike = { amount: number | string; currencyCode: string }

type ProductRef = {
  id: string
  variantId?: string
  title?: string
  vendor?: string
  category?: string | null
  price?: MoneyLike
  quantity?: number
}

type CartRef = { subtotal?: MoneyLike; lines: ProductRef[] }

type OrderRef = {
  orderId: string
  value: number
  currency: string
  tax?: number
  shipping?: number
  coupon?: string | null
  lines: ProductRef[]
}
```

Each `ProductRef` becomes one item: `id` → `item_id`, `title` → `item_name`,
`variantId` → `item_variant`, `vendor` → `item_brand`, `category` →
`item_category`, `Number(price.amount)` → `price` and `quantity` →
`quantity`, which defaults to 1. `toItem(product)` performs this conversion on
its own.

</details>

## What each provider receives

GA4 and Meta rename standard events to their own vocabulary. Every other
provider receives the name you passed to `track()`.

| Standard event | GA4 | Meta |
|---|---|---|
| `view_item` | `view_item` | `ViewContent` |
| `add_to_cart` | `add_to_cart` | `AddToCart` |
| `add_to_wishlist` | `add_to_wishlist` | `AddToWishlist` |
| `begin_checkout` | `begin_checkout` | `InitiateCheckout` |
| `add_payment_info` | `add_payment_info` | `AddPaymentInfo` |
| `purchase` | `purchase` | `Purchase` |
| `sign_up` | `sign_up` | `CompleteRegistration` |
| `lead` | `generate_lead` | `Lead` |
| `search` | `search` | `Search` |
| `contact` | `contact` | `Contact` |
| `trial_started` | `trial_started` | `StartTrial` |
| `subscription_started` | `subscription_started` | `Subscribe` |
| `customize_product`, `schedule`, `submit_application`, `find_location`, `donate` | unchanged | `CustomizeProduct`, `Schedule`, `SubmitApplication`, `FindLocation`, `Donate` |
| Any other name | Characters other than letters, digits and `_` replaced with `_` | Sent with `fbq('track')` if it is already one of Meta's standard event names, otherwise with `fbq('trackCustom')` under the original name |

The params each provider sends differ as follows:

| Provider | Call | Params |
|---|---|---|
| GA4 | `gtag('event', name, params)` | The event params, merged with `providers.ga4` |
| Meta Pixel | `fbq('track' \| 'trackCustom', name, params, { eventID })` | Translated as described below, merged with `providers.meta` |
| PostHog | `posthog.capture(name, params)` | The event params, merged with `providers.posthog` |
| Vercel | The `trackEvent` function you pass | Top-level strings, numbers, booleans and `null`; `undefined` becomes `null`, a `Date` becomes an ISO string, and every other value is dropped |
| Contentsquare | `_uxa.push(['trackPageEvent', name])` | None. `purchase` instead creates and sends an ecommerce transaction with `transaction_id`, `value` and `currency` as `id`, `revenue` and `currency` |
| Hotjar | `hj('event', name)` | None |

Sentry and TikTok receive no events: Sentry receives errors from
`captureError()`, and TikTok only forwards consent to a `ttq` you load
yourself.

Meta receives `items[]` as `content_ids`, `contents` (`id`, `quantity`,
`item_price`), `content_type: 'product'` and `num_items`, the sum of the item
quantities. Each item's ID is its `item_variant` when present and its
`item_id` otherwise, and a missing quantity counts as 1. `search_term` is
renamed to `search_string`. Every other param is passed through.

### Consent

An event reaches a provider only while the provider's consent requirement is
met: analytics for GA4, Contentsquare and Hotjar, and marketing for Meta and
TikTok. Vercel and Sentry require no consent. PostHog requires none in its
default cookieless mode, and analytics with `cookieless: false`; PostHog and
Sentry add cookies, session recording and user data only once analytics is
granted. [Providers](/guides/providers/) documents each provider's options
and [provider internals](/internals/providers/) the exact calls.

When `server.endpoint` is set, each event is also posted once to that route
while analytics or marketing is granted, with its ID, name, params, URL and
the `only` and `providers` options. See
[server-side tracking](/guides/server-side-tracking/).

## Event options

The third argument of `track()` scopes a single event.

```ts
analytics.track('purchase', params, {
  eventId: order.id,
  only: ['ga4', 'meta'],
  providers: { meta: { content_category: 'shoes' } },
  requireMarketingConsent: true,
})
```

| Option | Type | Behaviour |
|---|---|---|
| `eventId` | `string` | ID shared by the browser and server events so destinations can deduplicate them; Meta receives it as `eventID` and the Conversions API as `event_id`. Defaults to `crypto.randomUUID()`. |
| `only` | `string[]` | Provider IDs that receive the event. Other providers skip it. |
| `providers` | `Record<string, Record<string, unknown>>` | Extra params for one provider, keyed by provider ID and merged over the event params. Read by GA4, Meta and PostHog, and by the Meta Conversions API on the server. |
| `requireAnalyticsConsent` | `boolean` | Drops the event, for providers and the server endpoint alike, unless analytics is granted when it is delivered. |
| `requireMarketingConsent` | `boolean` | The same, for marketing. |

## Identity

`identify(userId?, traits?)` records who the visitor is, and `reset()` forgets
it.

```ts
await analytics.identify('user_123', { email: 'ada@example.com', plan: 'pro' })
await analytics.reset()
```

- **User ID.** Converted to a string and passed to every provider that accepts
  one, whatever the consent state. Identifying a different user ID first
  discards the current identity, including email and phone. Calling
  `identify(undefined, traits)` keeps the current user ID.
- **Email and phone.** Read from `traits.email` and `traits.phone`. Email is
  trimmed and lowercased; phone loses spaces, hyphens, parentheses and dots
  and must then be an E.164 number. Invalid values are dropped silently.
  Providers receive them only while marketing is granted. Until then they are
  held in memory until the next consent change, which shares them if it grants
  marketing and discards them if it doesn't. Withdrawing marketing discards
  them: active providers are identified again without them, and providers no
  longer active are reset.
- **Other traits.** Passed to the providers' `identify` calls for this call
  only; they are not stored.
- **Storage.** The identity is written to localStorage under
  `consentlayer_user_identity` (see [Names](/guides/names/)) only while
  analytics or marketing is granted, and removed otherwise. On the next page
  load the user ID is restored, and the stored email and phone are restored
  only if marketing is granted and the stored user ID still matches.
- **Late providers.** A provider that becomes active later, for example when
  its consent is granted, is identified with the current identity when it
  starts.
- **Before boot.** `track`, `page`, `identify`, `group` and `captureError`
  calls made before `boot()` completes are queued and delivered in order,
  right after boot, to the providers consent allows at that moment. The queue
  holds 100 calls; later ones are dropped and a single `queue-full` error is
  reported to `onError`.

| Provider | User ID | Email and phone (marketing granted) |
|---|---|---|
| GA4 | `gtag('set', { user_id })` | `gtag('set', 'user_data', { email, phone_number })`. Requires [user-provided data collection](https://support.google.com/analytics/answer/14077171) to be enabled in GA4 admin. |
| Meta Pixel | `external_id` in advanced matching | `em` and `ph` in advanced matching. The pixel accepts these only in `fbq('init')`, so it receives the identity known when it loads, usually none on a first visit. |
| Meta Conversions API | `external_id`, SHA-256 hashed, on every event | `em` and `ph`, SHA-256 hashed, on every event |
| PostHog | `posthog.identify(userId, traits)`, while analytics is granted | `email` added to the person properties |
| Sentry | `Sentry.setUser({ id })`, while analytics is granted | `email` |
| Contentsquare | `identify` | Not sent |
| Hotjar | `hj('identify', userId, traits)` | `email` as an attribute, only with a user ID |
| Vercel | Not sent | Not sent |

### Logging out

`reset()` clears the identity in memory and in storage, then calls `reset` on
every provider that has been set up, whatever the current consent:

| Provider | Effect of `reset()` |
|---|---|
| GA4 | Sets `user_id` to `null` and `user_data` to `{}` |
| PostHog | Calls `posthog.reset()` and reapplies the current consent |
| Sentry | Calls `Sentry.setUser(null)` |
| Contentsquare | Sends `resetIdentity` |
| Hotjar | Identifies as anonymous with `hj('identify', null, {})` |
| Meta Pixel | No effect |

Two vendors cannot fully forget a user without a page load:

- The Meta pixel keeps the advanced-matching data from `fbq('init')` until the
  page is reloaded. If the pixel was initialised with an email or phone and
  marketing is then withdrawn, the pixel stays revoked for the rest of the
  page, even if marketing is granted again.
- Hotjar has no API to remove the email attribute or to log out. It keeps
  linking the browser to the last user until its cookies are cleared, which
  ConsentLayer does when analytics consent is withdrawn.

### Groups

`analytics.group(groupId, traits?)` is queued and delivered like `track()`, to
the providers that implement groups. Among the built-in providers only PostHog
does, with `posthog.group(groupType, groupId, traits)` while analytics is
granted; `groupType` is a PostHog option that defaults to `company`.

## Consent

`analytics.consent` reads and changes the visitor's choice.

```ts
await analytics.consent.update({ analytics: true })
const consent = analytics.consent.getConsent()
const unsubscribe = analytics.consent.subscribe(({ consent }) => {
  console.log(consent?.marketing)
})
```

| Member | Behaviour |
|---|---|
| `categories` | Every category the visitor can toggle: `preferences`, `analytics` and `marketing`, followed by your [custom categories](/guides/consent-ui/#custom-categories). |
| `getConsent()` | The current `ConsentState`, or `null` until the visitor has chosen. |
| `update(partial)` | Waits for `bootstrap()`, then merges `partial` into the current state. Categories left out keep their value; unset categories are denied. |
| `setConsent(consent)` | Replaces the whole state. Throws a `TypeError` (`[consentlayer] consent must have boolean preferences, analytics and marketing, received …`) unless every category is a boolean. |
| `bootstrap()` | Reads the stored consent, or asks the consent adapters when nothing is stored. Runs once; later calls return the same promise. `<AnalyticsProvider>` calls it for you. |
| `subscribe(listener)` | Calls `listener({ consent })` after every change and returns an unsubscribe function. |

A change that leaves the state unchanged is ignored. `update()` and
`setConsent()` store the new state, broadcast it to other scripts (see
[Names](/guides/names/)), notify subscribers and providers, and then send it
to the consent adapters and the `server.consentEndpoint`, resolving once they
have finished. A change read from another tab is broadcast and applied but not
stored or sent again.

In React, `useConsent()` returns `{ consent, update, setConsent, engine }`,
where `engine` is `analytics.consent`, and re-renders when consent changes.
Like `useAnalytics()`, it works outside `<AnalyticsProvider>` by using the
instance the most recent `createAnalytics()` call created. To build a banner,
see [Consent UI](/guides/consent-ui/).
