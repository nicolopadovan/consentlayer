---
'consentlayer': minor
---

Add rules per visitor region. Pass the region with `consent.region`, read on the server with `regionFromHeaders()` from `consentlayer/server` (Vercel, Cloudflare and Amazon CloudFront headers) or with `data-region` on the script tag. By default the US grants every category before a choice without a banner, with Global Privacy Control keeping marketing off; Switzerland grants preferences and analytics and still asks; France asks again after 180 days; every other region, and an unknown one, keeps the opt-in model. `consent.regions` adds or replaces rules, and `canadaRegions` and `ukStatisticsRegions` are available. `analytics.consent.getRegion()` and `shouldAsk()` expose the rule in force, and the consent controller's `bannerVisible` follows it.
