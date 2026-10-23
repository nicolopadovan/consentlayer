---
'consentlayer': minor
---

Auto-tracking no longer sends `consentlayer.page_session_start` by default, because it duplicated the page view each provider already sends. Set `autoTracking({ pageViews: true })` to keep it. The other auto-tracking events still carry `session_id`.
