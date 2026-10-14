---
'consentlayer': minor
---

Every provider and server destination takes an `events` option: the event names `track()` sends to it, or `false` for none. Analytics providers receive every event by default. The Meta and TikTok pixels, `metaCapi` and `tiktokEvents` now receive only events that map to one of their standard events; custom and auto-tracking events reach them only when listed. An event whose `only` option names a provider is always sent to it.

`autoTracking()` no longer takes `only`; use the providers' `events` option instead.

Declare your own events in a `Register` interface (`declare module 'consentlayer' { interface Register { events: { … } } }`) to type their params. Once declared, `track()` rejects undeclared names.
