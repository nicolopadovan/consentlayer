---
title: Hotjar (deprecated)
description: "hotjar() loads Hotjar after analytics consent. Deprecated: Hotjar accounts are moving to Contentsquare."
---

`hotjar()` from `consentlayer/providers/hotjar` loads Hotjar once `analytics`
consent is granted. It is deprecated: Hotjar accounts are moving to
Contentsquare, so switch to [`contentsquare()`](/guides/providers/contentsquare/)
once yours has.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `siteId` | `number \| string \| undefined` | Required | The Hotjar site ID, as a number or a string of digits. |
| `version` | `number \| string \| undefined` | Required | The snippet version, `hjsv`, as a number or a string of digits. |
| `reloadOnRevoke` | `boolean` | `false` | Reloads the page when analytics consent is withdrawn. |

An unset, empty or whitespace-only `siteId` or `version` turns the provider
off. Surrounding whitespace is trimmed. Any other value that is not a positive
integer written in digits, such as `'1e3'` or `'12.0'`, throws `[consentlayer] Invalid Hotjar siteId or
version: expected positive integers, …`.

## How it works

Events are sent as `hj('event', name)`. `identify` calls
`hj('identify', userId, traits)`, adding the email to the attributes when both
a user ID and an email are known.

## Withdrawing consent

Hotjar's script cannot be stopped once loaded. Withdrawing analytics consent
expires every cookie whose name starts with `_hj` and removes every
`localStorage` and `sessionStorage` key matching `^_?hj`, but the script keeps
running until the page reloads. Set `reloadOnRevoke: true` to reload
immediately.
