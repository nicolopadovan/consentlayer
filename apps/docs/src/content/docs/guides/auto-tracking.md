---
title: Auto-tracking
description: Send page session, click, scroll depth and time-on-page events automatically once analytics consent is granted.
---

`autoTracking()` from `consentlayer/auto-tracking` sends page session, click,
scroll depth and time-on-page events without a `track` call for each. It is a
separate entry point, so applications that don't use it don't download it.

```ts
import { createAnalytics } from 'consentlayer'
import { autoTracking } from 'consentlayer/auto-tracking'

export const analytics = createAnalytics({
  providers: [/* ... */],
  autoTracking: autoTracking(),
})
```

The [script tag](/start/script-tag/) includes it: set `autoTracking: true`, or
an object with the options below, in its configuration.

## Events

Auto-tracking starts after boot, once `analytics` consent is granted, and sends
each event to every active provider whose
[`events` option](/guides/events/#routing-events) includes it. The Meta and
TikTok pixels leave them out by default. `autoTracking()` from `consentlayer/auto-tracking` enables
every kind with its defaults. An object that turns kinds on enables only
those: `autoTracking({ clicks: { mode: 'attribute' } })` sends clicks alone,
while `autoTracking({ scroll: false })` keeps every kind but scroll.

| Option       | Default                                    | Event                                                                                                                      | Params                                                   |
| ------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `pageViews`  | `true`                                     | `consentlayer.page_session_start`, on start and on every route change                                                      | `session_id`                                             |
| `clicks`     | `{ mode: 'all', attribute: 'data-track' }` | `consentlayer.ui_click`, for clicks on `button`, `[role="button"]`, `a`, `input[type="submit"]` and `input[type="button"]` | `ui_target`, `ui_element`, `ui_id`, `path`, `session_id` |
| `scroll`     | `{ thresholds: [25, 50, 75, 100] }`        | `consentlayer.scroll_depth`, once per threshold and page session                                                           | `depth`, `session_id`                                    |
| `timeOnPage` | `{ intervals: [5, 15, 30, 60, 120] }`      | `consentlayer.time_on_page`, after each interval in seconds                                                                | `seconds`, `session_id`                                  |

With `clicks: { mode: 'attribute' }`, only elements carrying the attribute
are tracked. `ui_target` is the first non-empty value of the attribute and
`aria-label`, never the element's text. The
event names derive from [`names.prefix`](/guides/names/).

## Page sessions

Each route is a page session. `analytics.newPageSession()` starts a new one: it
sends `page_session_start` again and restarts the scroll and time counters. The
consent controller behind every framework integration calls it when the route
key changes, as described in [Add the banner](/start/react/#3-add-the-banner);
call it yourself when you track routes without one.

## Errors

`createAnalytics()` throws if `autoTracking` is not the value `autoTracking()`
returns, such as the `true` of earlier versions. An error thrown while
auto-tracking starts or begins a page session is reported to `onError` with
scope `auto-tracking`; providers and consent keep working.
