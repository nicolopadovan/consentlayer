---
'consentlayer': minor
---

Auto-tracking events carry `page_index`, the number of the page session in the current page load. `session_id` still carries the same value but is deprecated and will be removed in 2.0; it was never a session ID. A click on a link that sends `outbound_click` or `file_download` no longer also sends `ui_click`, unless the link has the tracking attribute.
