---
title: PostHog
description: "posthog() sends page views, events and errors to PostHog, cookieless until analytics consent."
---

`posthog()` from `consentlayer/providers/posthog` sends page views, events and
errors to PostHog. It is built on PostHog's npm SDK, `posthog-js`, an optional
peer dependency:

```bash
pnpm add posthog-js
```

```ts
import { posthog } from 'consentlayer/providers/posthog'

posthog({ apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY })
```

The SDK is imported with a dynamic `import()` when the provider loads, and
session recording, which pulls in more code, is off by default and imported
only once enabled and consented to.

## Options

| Option        | Type                                         | Default                      | Description                                                                                                                                                                  |
| ------------- | -------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`      | `string \| undefined`                        | Required                     | The project API key.                                                                                                                                                         |
| `apiHost`     | `string`                                     | `'https://us.i.posthog.com'` | The ingestion host, or a reverse-proxy path.                                                                                                                                 |
| `uiHost`      | `string`                                     | None                         | PostHog's app URL, such as `https://us.posthog.com`, for toolbar links when `apiHost` is a proxy.                                                                            |
| `cookieless`  | `boolean`                                    | `true`                       | `true` loads PostHog at boot in cookieless mode (`cookieless_mode: 'on_reject'`). `false` makes the provider require analytics consent and load nothing before it.           |
| `autocapture` | `boolean`                                    | `false`                      | PostHog autocapture.                                                                                                                                                         |
| `recording`   | `boolean`                                    | `false`                      | Session recording, started after analytics consent. Imports `posthog-js/dist/posthog-recorder` on first use. Recording must also be enabled in the PostHog project settings. |
| `errors`      | `boolean`                                    | `true`                       | Sends `captureError` errors to PostHog error tracking with `captureException`.                                                                                               |
| `groupType`   | `string`                                     | `'company'`                  | The group type `analytics.group()` uses.                                                                                                                                     |
| `defer`       | `false \| 'idle' \| 'interaction' \| number` | `false`                      | See [Loading SDKs later](/guides/providers/#loading-sdks-later).                                                                                                             |
| `events`      | `string[] \| false`                          | All events                   | The event names `track()` sends to it; `false` sends none. See [Routing events](/guides/events/#routing-events).                                                             |

## How it works

PostHog never captures page views, page leaves, exceptions, heatmaps or dead
clicks on its own, and its feature flags, surveys and remote script loading
are disabled: page views, events and errors come from ConsentLayer. It starts
opted out of capturing and persistence. With the default `cookieless: true`,
PostHog counts visitors in its cookieless mode until analytics consent is
granted, then opts in and uses cookies; this requires cookieless mode to be
enabled in the PostHog project settings. `identify` and `group` are sent only
with analytics consent.

Page views are captured as `$pageview` with `$current_url` and `title`.
`track` captures the event name with its params merged with
`options.providers.posthog`. `identify` sends the user ID, with the email as a
person property when it is known. `reset` calls PostHog's `reset()` and
re-applies the current consent.

## Reverse proxy

Ad blockers drop requests to `posthog.com`. Serving them through your own
domain avoids this.

Add the rewrites from [PostHog's guide](https://posthog.com/docs/advanced/proxy/nextjs),
then set `apiHost` to the proxy path and `uiHost` to PostHog's app URL. For an
EU project, replace `us` with `eu` in every host.

```js
// next.config.js
export default {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/array/:path*', destination: 'https://us-assets.i.posthog.com/array/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
}
```

```ts
posthog({ apiKey, apiHost: '/ingest', uiHost: 'https://us.posthog.com' })
```
