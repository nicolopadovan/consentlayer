---
title: Names
description: Storage keys, globals, DOM events and CSS classes, and how to keep the pre-rc.2 acm names.
---

Every storage key, global, DOM event, auto-tracking event and CSS class
prefix comes from one place. Defaults use the `consentlayer` prefix:

| Name | Default |
|---|---|
| consent storage key | `consentlayer_consent` |
| identity storage key | `consentlayer_user_identity` |
| consent DOM event | `consentlayer:consent` |
| consent global | `window.CONSENTLAYER_CONSENT` |
| open-dialog global | `window.CONSENTLAYER_openConsent()` |
| auto-tracking events | `consentlayer.page_session_start`, `consentlayer.scroll_depth`, `consentlayer.time_on_page`, `consentlayer.ui_click` |
| UI class prefix | `cl-` |

Change them with `createAnalytics({ names })` (or `configureNames()` before
the first consent read):

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

Until 1.0.0-rc.1 the prefix was `acm`. With `legacy: true`:

- a stored `acm_consent` / `acm_user_identity` value is moved to the new key on first read;
- `acm:consent` is dispatched and `ACM_CONSENT` / `ACM_openConsent` are set alongside the new names;
- provider window flags are read and written under both `__consentlayer*` and `__acm*`;
- `.acm-*` classes and `--acm-*` variables keep working.

Auto-tracking events are renamed outright (`acm.*` → `consentlayer.*`), so dashboards
filtering on the old names need updating.

