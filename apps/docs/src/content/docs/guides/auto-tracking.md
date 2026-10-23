---
title: Auto-tracking
description: Send page session, click, scroll depth, time-on-page, outbound link, download, site search, video and form events automatically once analytics consent is granted.
---

`autoTracking()` from `consentlayer/auto-tracking` sends page session, click,
scroll depth, time-on-page, outbound link, download, site search, video and
form events without a `track` call for each. Together they cover what Google
Analytics calls enhanced measurement, for every provider and only after
consent. It is a
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
every kind except `pageViews` with its defaults. An object that turns kinds on enables only
those: `autoTracking({ clicks: { mode: 'attribute' } })` sends clicks alone,
while `autoTracking({ scroll: false })` keeps every kind but scroll.

| Option           | Default                                                | Event                                                                                                                                                   | Params                                                                                                                              |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pageViews`      | `false`                                                | `consentlayer.page_session_start`, on start and on every route change                                                                                   | `page_index`                                                                                                                        |
| `clicks`         | `{ mode: 'all', attribute: 'data-track' }`             | `consentlayer.ui_click`, for clicks on `button`, `[role="button"]`, `a`, `input[type="submit"]` and `input[type="button"]`                              | `ui_target`, `ui_element`, `ui_id`, `path`, `page_index`                                                                            |
| `scroll`         | `{ thresholds: [25, 50, 75, 100] }`                    | `consentlayer.scroll_depth`, once per threshold and page session                                                                                        | `depth`, `page_index`                                                                                                               |
| `timeOnPage`     | `{ intervals: [5, 15, 30, 60, 120] }`                  | `consentlayer.time_on_page`, after each interval in seconds                                                                                             | `seconds`, `page_index`                                                                                                             |
| `outboundClicks` | `true`                                                 | `consentlayer.outbound_click`, for a click on a link to another host name                                                                               | `link_url`, `link_domain`, `link_id`, `page_index`                                                                                  |
| `downloads`      | `{ extensions: [...] }`, listed below                  | `consentlayer.file_download`, for a click on a link whose path ends in one of the extensions                                                            | `link_url`, `link_id`, `file_name`, `file_extension`, `page_index`                                                                  |
| `siteSearch`     | `{ params: ['q', 's', 'search', 'query', 'keyword'] }` | `consentlayer.site_search`, at the start of a page session whose URL has one of the query parameters                                                    | `search_term`, `page_index`                                                                                                         |
| `video`          | `true`                                                 | `consentlayer.video_start`, `consentlayer.video_progress` at 10, 25, 50 and 75% and `consentlayer.video_complete`, once each per video and page session | `video_provider`, `video_url`, `video_title`, `video_current_time`, `video_duration`, `video_percent` (progress only), `page_index` |
| `forms`          | `true`                                                 | `consentlayer.form_start` on the first focus inside a form, once per form and page session, and `consentlayer.form_submit` on each submit               | `form_id`, `form_name`, `form_destination`, `page_index`                                                                            |

With `clicks: { mode: 'attribute' }`, only elements carrying the attribute
are tracked. `ui_target` is the first non-empty value of the attribute and
`aria-label`, never the element's text. The
event names derive from [`names.prefix`](/guides/names/).

The parameters of the newer kinds use the names Google Analytics uses, so
every provider receives the same readable data. No kind sends the text of a
link or the values of a form's fields. A click on a link that sends
`outbound_click` or `file_download` does not also send `ui_click`, unless the
link carries the tracking attribute. A link to a file on another host sends
both `file_download` and `outbound_click`. The `downloads` extensions are
compared in lower case, without the dot; the default list is `pdf`, `xls`,
`xlsx`, `doc`, `docx`, `txt`, `rtf`, `csv`, `exe`, `key`, `pps`, `ppt`,
`pptx`, `7z`, `pkg`, `rar`, `gz`, `zip`, `avi`, `mov`, `mp4`, `mpe`, `mpeg`,
`wmv`, `mid`, `midi`, `mp3`, `wav` and `wma`.

## Video

`video` tracks every `<video>` element, with `video_provider: 'html5'`, and
YouTube embeds, with `video_provider: 'youtube'`. A YouTube embed is tracked
only when its URL has `enablejsapi=1`, as GA4 requires too:

```html
<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID?enablejsapi=1"></iframe>
```

ConsentLayer loads no YouTube script. It asks the embed for its playback
state with the player's `postMessage` protocol and reads the replies. A
YouTube embed sets YouTube's own cookies when it loads, whatever the
visitor chose; auto-tracking does not change that. See
[Embeds behind consent](/guides/roadmap/#embeds-behind-consent).

## Google Analytics

The [GA4 provider](/guides/providers/ga4/#enhanced-measurement) and the
[Measurement Protocol destination](/guides/server-side-tracking/) send these events under
the names of GA4's enhanced measurement, so its built-in reports use them:

| Event                                                                                    | GA4 event                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `consentlayer.scroll_depth`                                                              | `scroll`, with `percent_scrolled`                 |
| `consentlayer.outbound_click`                                                            | `click`, with `outbound: true`                    |
| `consentlayer.file_download`                                                             | `file_download`                                   |
| `consentlayer.site_search`                                                               | `view_search_results`                             |
| `consentlayer.video_start`, `consentlayer.video_progress`, `consentlayer.video_complete` | `video_start`, `video_progress`, `video_complete` |
| `consentlayer.form_start`, `consentlayer.form_submit`                                    | `form_start`, `form_submit`                       |

GA4's own enhanced measurement sends the same interactions, so with both on
each one is counted twice. Turn enhanced measurement off, as described in
[Enhanced measurement](/guides/providers/ga4/#enhanced-measurement):
auto-tracking waits for analytics consent, applies
[redaction](/guides/redaction/), reaches every provider and is configured in
code. If you prefer to keep GA4's settings, turn off the matching kinds
instead and keep the rest:

```ts
autoTracking({ scroll: false, outboundClicks: false, downloads: false, siteSearch: false, video: false, forms: false })
```

## Page sessions

Every auto-tracking event carries `page_index`, the number of the page
session in the current page load: `1` for the first route, `2` after the next
route change, and so on. It groups the scroll, time and click events of one
route; it is not GA4's session ID. The same value is also sent as
`session_id`, which is deprecated and will be removed in 2.0.

Each route is a page session. `analytics.newPageSession()` starts a new one: it
increments `page_index`, restarts the scroll and time counters and, with
`pageViews: true`, sends `page_session_start`. The
consent controller behind every framework integration calls it when the route
key changes, as described in [Add the banner](/start/react/#3-add-the-banner);
call it yourself when you track routes without one.

## Errors

`createAnalytics()` throws if `autoTracking` is not the value `autoTracking()`
returns, such as the `true` of earlier versions. An error thrown while
auto-tracking starts or begins a page session is reported to `onError` with
scope `auto-tracking`; providers and consent keep working.
