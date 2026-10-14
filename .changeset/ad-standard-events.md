---
'consentlayer': minor
---

The Meta and TikTok pixels, `metaCapi` and `tiktokEvents` now receive only events that map to a standard event of theirs. Custom events, including auto-tracking events, are no longer sent to them unless listed in the new `events` option. An event whose `only` option names the provider is always sent.
