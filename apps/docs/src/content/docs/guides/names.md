---
title: Names
description: The storage keys, window globals and event names ConsentLayer uses, how to rename them, and how to keep reading the acm names.
---

This page lists every name ConsentLayer writes to the page: localStorage
keys, window globals, DOM events and auto-tracking event names. It explains
how to change them with the `names` option of `createAnalytics()`, and how
`legacy` mode reads the `acm` names used by
`@nicolopadovan/analytics-consent-manager`.

## Default names

Every name derives from a single prefix, `consentlayer` by default. In the
table, `PREFIX` is the prefix in upper case.

| Name                 | Default                                                                                                              | Derived as                   | Override                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| Consent storage key  | `consentlayer_consent`                                                                                               | `<prefix>_consent`           | `consentStorageKey`                                                              |
| Identity storage key | `consentlayer_user_identity`                                                                                         | `<prefix>_user_identity`     | `identityStorageKey`                                                             |
| Server events key    | `consentlayer_server:<endpoint>`, in `sessionStorage`                                                                | `<prefix>_server:<endpoint>` | Prefix only                                                                      |
| Consent DOM event    | `consentlayer:consent`                                                                                               | `<prefix>:consent`           | `consentEventName`                                                               |
| Consent global       | `window.CONSENTLAYER_CONSENT`                                                                                        | `PREFIX_CONSENT`             | `consentGlobalKey`                                                               |
| Open-settings global | `window.CONSENTLAYER_openConsent()`                                                                                  | `PREFIX_openConsent`         | `openConsentGlobalKey`                                                           |
| Auto-tracking events | `consentlayer.page_session_start`, `consentlayer.scroll_depth`, `consentlayer.time_on_page`, `consentlayer.ui_click` | `<prefix>.<event>`           | `autoTrackingEvents.pageSessionStart`, `.scrollDepth`, `.timeOnPage`, `.uiClick` |
| Provider flags       | `window.__consentlayerMetaPixelInitialized` and similar                                                              | `__<prefix><Flag>`           | Prefix only                                                                      |

Whenever the consent state changes, including when stored consent is first
read, ConsentLayer sets the consent global to the new `ConsentState` and
dispatches the consent event on `document` as a `CustomEvent` whose `detail`
is that state. Scripts outside your bundle can read either:

```js
document.addEventListener('consentlayer:consent', (event) => {
  if (event.detail.marketing) loadAdsScript()
})
```

`<AnalyticsProvider>` defines the open-settings global when it mounts; calling
it opens the settings dialog of your [consent UI](/guides/consent-ui/).
Provider flags mark one-time setup, such as an injected script, so it is not
repeated.

## Renaming

Pass `names` to `createAnalytics()`. Every name you omit is derived from
`prefix`, and the auto-tracking event names can be overridden one by one.

```ts
createAnalytics({
  providers,
  names: {
    prefix: 'shop',                 // shop_consent, shop:consent, SHOP_CONSENT, …
    consentStorageKey: 'my_consent',
    autoTrackingEvents: { uiClick: 'click' },
  },
})
```

Names are page-wide state, not per instance, which is one reason to create
one instance per page. `createAnalytics()` resets them to the defaults and
then applies its own `names`, before it reads anything from storage. A second
call with different `names` logs this warning, and its names replace the
first ones:

```
[consentlayer] createAnalytics() was called again with different names. Storage keys, globals and events are per page, so the last names win: create one instance per page.
```

`getNames()`, exported from `consentlayer`, returns the resolved names in use.

<details>
<summary>Names that other options take precedence over</summary>

- `consent.storage` replaces the default localStorage consent storage, so the
  consent storage key is unused.
- `identityStorage` replaces the default identity storage, so the identity
  storage key is unused.
- `consent.broadcast` replaces the default broadcast configuration, including
  the consent event and global names.
- The `openConsentGlobalKey` prop of `<AnalyticsProvider>` replaces the
  open-settings global, and with it the legacy `ACM_openConsent` global.

</details>

## Migrating from `acm_*`

`@nicolopadovan/analytics-consent-manager` used the prefix `acm`. With
`names: { legacy: true }`, ConsentLayer reads the old names alongside the new
ones:

| Name                  | Behavior with `legacy: true`                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Storage keys          | When the consent or identity key has no value, the value under `acm_consent` or `acm_user_identity` is moved to the new key on first read and the old key is removed. New values are written only to the new keys. |
| DOM event and globals | `acm:consent` is dispatched, and `ACM_CONSENT` and `ACM_openConsent` are set, alongside the new names.                                                                                                             |
| Provider flags        | Read from `__consentlayer*`, falling back to `__acm*`, and written to both.                                                                                                                                        |
| Auto-tracking events  | No fallback. `acm.*` events are now sent as `consentlayer.*`.                                                                                                                                                      |

Update dashboards and filters that match the old auto-tracking event names,
or keep the old names with `autoTrackingEvents`. Setting `prefix: 'acm'`
instead keeps every old name, which makes `legacy` unnecessary.
