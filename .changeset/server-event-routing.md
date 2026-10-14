---
'consentlayer': patch
---

A server destination's `events` option now covers `page_view` as well, so `metaCapi({ events: ['lead'] })` no longer receives page views. `createAnalyticsHandler` answers with a `consentlayer-events` header listing the event names its destinations take, and the browser then forwards only those events, plus events with `only`, instead of every event.
