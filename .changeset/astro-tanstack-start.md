---
'consentlayer': minor
---

Add the `consentlayer/tanstack-start` and `consentlayer/astro` entry points. `consentlayer/tanstack-start` exports an `<AnalyticsProvider>` that sends a page view once each TanStack Router navigation has resolved, with the new path, query string and title; it needs `@tanstack/react-router` 1.29 or later, an optional peer dependency, and works with or without TanStack Start. `consentlayer/astro` exports `consentLayer(analytics, options?)`, which creates and starts a consent controller and sends a page view on every `astro:page-load` event, so page views follow `<ClientRouter />` navigations.
