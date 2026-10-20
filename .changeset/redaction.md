---
'consentlayer': minor
---

Redaction replaces email addresses with `(redacted)` in page views, event params and the URLs providers and server destinations receive, and the new `redact.queryParams` option does the same for the values of chosen query parameters. It is on by default for email addresses, so a URL or param that contains one arrives as `(redacted)` after upgrading; `redact: false` turns it off. GA4, Google Ads, PostHog and Contentsquare also receive the redacted page URL or query string they would otherwise read themselves. `identify` and `group` data is never redacted. `PluginContext` gains `redact`, and `RedactOptions` is exported.
