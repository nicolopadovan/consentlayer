---
'consentlayer': patch
---

GA4 no longer receives the `session_id` param. gtag.js and the Measurement Protocol read it as GA4's own session ID, so the auto-tracking `session_id` (the page counter, deprecated since 1.5.0) set each visitor's GA4 session ID to `1`; sites saw GA4 record page views but none of the events that followed, such as `add_to_cart`. `ga4()`, `ga4Server()` and `sgtm()` now leave it out; other providers still receive it until 2.0. Use `page_index` instead, and pass `providers: { ga4: { session_id } }` in `track` options to set GA4's session ID on purpose.
