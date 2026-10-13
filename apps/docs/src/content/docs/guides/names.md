---
title: Names
description: Rename the storage keys, globals and events consentlayer uses, or keep the old acm names.
---

consentlayer writes to storage, sets window globals and dispatches events
under names that all derive from one prefix, `consentlayer` by default:

| Name | Default |
|---|---|
| Consent storage key | `consentlayer_consent` |
| Identity storage key | `consentlayer_user_identity` |
| Consent DOM event | `consentlayer:consent` |
| Consent global | `window.CONSENTLAYER_CONSENT` |
| Open-settings global | `window.CONSENTLAYER_openConsent()` |
| Auto-tracking events | `consentlayer.page_session_start`, `consentlayer.scroll_depth`, `consentlayer.time_on_page`, `consentlayer.ui_click` |

Change them with `createAnalytics({ names })`. Names apply to the whole page,
not to one instance, so create one instance per page. A second
`createAnalytics()` call with different names logs a warning, and its names
replace the first ones.

```ts
createAnalytics({
  providers,
  names: {
    prefix: 'shop',                     // shop_consent, shop:consent, SHOP_CONSENT, …
    consentStorageKey: 'my_consent',    // any single name can be overridden
    legacy: true,                       // also read and write the acm_* names below
  },
})
```

## Migrating from `acm_*`

`@nicolopadovan/analytics-consent-manager` used the prefix `acm`. With
`legacy: true`:

- A stored `acm_consent` or `acm_user_identity` value moves to the new key the
  first time it is read.
- `acm:consent` is dispatched, and `ACM_CONSENT` and `ACM_openConsent` are set,
  alongside the new names.
- Provider window flags are read and written under both `__consentlayer*` and
  `__acm*`.

Auto-tracking events are renamed without a fallback (`acm.*` becomes
`consentlayer.*`), so update dashboards that filter on the old names.

