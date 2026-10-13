# Provider Configuration

## Providers

| Provider | Factory | Consent gate | Required config | Notes |
| --- | --- | --- | --- | --- |
| GA4 | `ga4` | `analytics` | `measurementId` | Initializes Google Consent Mode with denied defaults, then updates on consent changes |
| Meta Pixel | `meta` | `marketing` | `pixelId` | Browser pixel plus optional CAPI mirror; marketing consent is enforced in core |
| Shopify analytics | `shopify` | `analytics` | optional script URLs | Queues page/event payloads for Shopify browser analytics |
| Shopify Customer Privacy | `createShopifyCustomerPrivacyAdapter` | consent source | optional headless storefront config | Bootstraps and syncs consent state |
| Hotjar | `hotjar` | `analytics` | `siteId`, `version`, `reloadOnRevoke` | Loads only after analytics consent; on withdrawal its cookies and storage are deleted, but its script keeps running and recreates them until the page reloads; set `reloadOnRevoke` to reload and stop it |
| TikTok consent bridge | `tiktok` | `marketing` | `ttq` loaded by consumer | Consent sync only; no SDK bootstrap in package |
| Vercel Analytics | `vercel` | none (cookieless) | `trackEvent` from `@vercel/analytics` | Receives events whatever the consent |

Pass browser providers to `createAnalytics({ providers: [...] })` and consent
sources such as Shopify Customer Privacy to
`createAnalytics({ consent: { adapters: [...] } })`.

## Environment Variables Used By The Example App

- `NEXT_PUBLIC_ENABLE_ANALYTICS`
- `NEXT_PUBLIC_ANALYTICS_DEBUG`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `NEXT_PUBLIC_HOTJAR_SITE_ID`
- `NEXT_PUBLIC_HOTJAR_VERSION`
- `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`
- `NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT`
- `NEXT_PUBLIC_SHOPIFY_STORE_ID`
- `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`
- `NEXT_PUBLIC_SHOPIFY_PUBLIC_ACCESS_TOKEN`
- `META_TOKEN`
- `FACEBOOK_TEST_EVENT_CODE`
- `GA4_API_SECRET`

## Consent Notes

- analytics providers should never initialize without analytics consent
- Meta should never dispatch without marketing consent
- consent updates are broadcast to adapters and to the configured DOM/global channel

## Storage And Broadcast Defaults

The package default runtime preset uses:

- `npcm_consent`
- `npcm_user_identity`
- `npcm:consent`
- `NPCM_CONSENT`
- `NPCM_openConsent`

Change them with `configureNames()`; see "Names" in the README. The pre-rc.2
`acm_*` names are still read, migrated and broadcast unless `legacy: false`.

## Loading Before Consent

GA4 and Meta load their scripts at boot by default, with consent denied
(Consent Mode / `fbq('consent', 'revoke')`), and only send data once the
category is granted. Fetching the script still sends the visitor's IP to
Google or Meta. To load nothing until consent:

```ts
ga4({ measurementId, loadBeforeConsent: false })
meta({ pixelId, loadBeforeConsent: false })
```
