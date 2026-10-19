---
'consentlayer': patch
---

The browser now keeps the event names a server route reports in `consentlayer-events`, and `consentlayer-forwarding: off`, in `sessionStorage` under `consentlayer_server:<endpoint>`. Later page loads in the same tab no longer post page views and session starts the route would drop before its first response. A response without `consentlayer-events` now lifts an earlier list.
