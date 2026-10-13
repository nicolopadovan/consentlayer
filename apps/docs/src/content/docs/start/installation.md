---
title: Installation
description: Install consentlayer and the optional provider SDKs.
---

```bash
pnpm add consentlayer
```

Install the SDK of each provider you use as well; they are optional peer
dependencies, so nothing is pulled in for providers you don't use:

| You use | Also install |
|---|---|
| `consentlayer/react` | `react`, `react-dom` |
| `posthog()` | `posthog-js` |
| `sentry()` | `@sentry/browser` |
| `consentlayer/sentry/server`, `consentlayer/sentry/next` | `@sentry/nextjs` |

## Entry Points

- `consentlayer`
- `consentlayer/react`
- `consentlayer/server` (plus `/server/ga4` for `ga4Server`, `/server/meta` for `metaCapi`)
- `consentlayer/ecommerce`
- `consentlayer/testing`
- `consentlayer/providers/*`
- `consentlayer/sentry/server`, `consentlayer/sentry/next`
