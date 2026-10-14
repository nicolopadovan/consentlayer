---
'consentlayer': minor
---

Add the Google Ads, Microsoft Clarity and LinkedIn Insight providers: `googleAds()` from `consentlayer/providers/google-ads`, `clarity()` from `consentlayer/providers/clarity` and `linkedin()` from `consentlayer/providers/linkedin`, also available in the script tag. Google Ads and LinkedIn need marketing consent and receive only the events mapped in their `conversions` option; Clarity needs analytics consent and follows every consent change through its consent API. gtag.js now loads once per page for all Google tags, and `ga4()` addresses its page views and events to its own measurement ID with `send_to`.
