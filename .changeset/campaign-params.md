---
'consentlayer': minor
---

The landing page's campaign parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` and `utm_id`) are kept in memory and added to the first page view each provider and server destination receives, so a visitor who consents on a later page is still attributed to the campaign. Nothing is stored before consent. The new `campaign` option adds parameter names with `params`, and `campaign: false` turns it off.
