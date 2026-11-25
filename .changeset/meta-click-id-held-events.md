---
'consentlayer': minor
---

The Meta Pixel provider keeps the landing page's `fbclid` and, once marketing consent is granted and the visitor has no `_fbc` cookie, sets `_fbc` from it, so a visitor who consents on a later page is still matched to the ad click. It is kept in memory by default; `meta({ clickId: 'session' })` also keeps it in sessionStorage for sites with full page loads, and `clickId: false` turns it off. `metaCapi` builds `fbc` from an `fbclid` in the event URL when the request has no `_fbc` cookie.

The new `holdUntilChoice` option holds page views and events that consent keeps from a provider or the server while the banner asks, up to 100 and in memory only, and delivers them to whatever the visitor's choice allows. It is off by default. With `server.consentEndpoint`, held events wait up to 3 seconds for the endpoint to record the choice, so a handler with `consentCookie` sees it.
