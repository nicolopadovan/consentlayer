---
'consentlayer': minor
---

When a visitor grants marketing after analytics on the same route, the automatic page view now reaches marketing server destinations such as the Meta Conversions API, without being sent twice to those that already have it. `page()`'s `server` option accepts an array of categories, and `ServerEvent` has a `categories` field that `sendServerEvent` honors.
