# Provider Configuration

## Providers

| Provider | Factory | Consent gate | Required config | Notes |
| --- | --- | --- | --- | --- |
| GA4 | `createGa4Adapter` | `analytics` | `measurementId` | Initializes Google Consent Mode with denied defaults, then updates on consent changes |
| Meta Pixel | `createMetaAdapter` | `marketing` | `pixelId` | Browser pixel plus optional CAPI mirror; marketing consent is enforced in core |
| Shopify analytics | `createShopifyAnalyticsAdapter` | `analytics` | optional script URLs | Queues page/event payloads for Shopify browser analytics |
| Shopify Customer Privacy | `createShopifyCustomerPrivacyAdapter` | consent source | optional headless storefront config | Bootstraps and syncs consent state |
| Hotjar | `createHotjarAdapter` | `analytics` | `siteId`, `version` | Loads only after analytics consent |
| TikTok consent bridge | `createTikTokConsentAdapter` | `marketing` | `ttq` loaded by consumer | Consent sync only; no SDK bootstrap in package |

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

- `acm_consent`
- `acm_user_identity`
- `acm:consent`
- `ACM_CONSENT`
- `ACM_openConsent`

These defaults are neutral and no longer tied to the decommissioned storefront namespace.
