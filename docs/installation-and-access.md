# Installation

```bash
pnpm add consentlayer
```

Install the SDK of each provider you use as well; they are optional peer
dependencies, so nothing is pulled in for providers you don't use:

| You use | Also install |
|---|---|
| `consentlayer/react`, `consentlayer/ui` | `react`, `react-dom` |
| `posthog()` | `posthog-js` |
| `sentry()` | `@sentry/browser` |
| `consentlayer/sentry/server`, `consentlayer/sentry/next` | `@sentry/nextjs` |

## Entry Points

- `consentlayer`
- `consentlayer/react`
- `consentlayer/ui` (plus `consentlayer/ui/styles.css`)
- `consentlayer/server` (plus `/server/ga4`, `/server/meta`)
- `consentlayer/ecommerce`
- `consentlayer/testing`
- `consentlayer/providers/*`
- `consentlayer/sentry/server`, `consentlayer/sentry/next`
