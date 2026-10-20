---
'consentlayer': minor
---

Auto-tracking now sends outbound link clicks, file downloads, site search, video engagement (`<video>` and YouTube embeds with `enablejsapi=1`) and form interactions to every provider, after analytics consent. All five are on by default, so an app that uses `autoTracking()` sends these events after upgrading; turn a kind off with, for example, `autoTracking({ forms: false })`. The GA4 provider and the Measurement Protocol destination send them, and scroll depth, under GA4's enhanced measurement names. The GA4 entry point exports `ga4Event`.
