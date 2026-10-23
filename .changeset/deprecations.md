---
'consentlayer': patch
---

Deprecate `names.legacy` and `createEnvConfig`, both removed in 2.0. To keep moving stored consent from the `acm_*` keys, pass them as `legacyKeys` to `createLocalStorageConsentStorage()` and `createLocalStorageIdentityStorage()`; see the Names guide.
