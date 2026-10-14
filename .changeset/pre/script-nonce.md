---
'consentlayer': minor
---

Add a `nonce` option to `createAnalytics()`. ConsentLayer sets it on every script it injects, including the inline base code of `meta()` and `tiktok()`, for a Content Security Policy that allows scripts by nonce. The script-tag build reads it from its own `<script>` tag.
