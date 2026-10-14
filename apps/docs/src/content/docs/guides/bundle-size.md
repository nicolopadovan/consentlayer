---
title: Reduce bundle size
description: How ConsentLayer keeps out of your bundle what you don't use, and what you can do to ship less.
---

ConsentLayer is built so that your bundle contains only the parts you import.
The package is ES modules only and declares `"sideEffects": false`, so any
bundler that tree-shakes, such as Vite, Rollup, esbuild, webpack or
Turbopack, drops the exports you don't use. The package's CI measures the
entry points on every change; see [Bundle size](/#bundle-size) for the current
figures.

## Import only what you use

Each provider, consent adapter and server destination is its own entry point,
and the root entry exports none of them. Importing `ga4()` never bundles
`meta()` or `posthog()`:

```ts
import { createAnalytics } from 'consentlayer'
import { ga4 } from 'consentlayer/providers/ga4'
```

A provider turned off by an `undefined` ID, such as
`meta({ pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID })` without the
variable, still ships its code. To keep a provider out of the bundle, don't
import it.

From the root entry, only the exports you use are bundled. `createAnalytics()`
alone measures 6.5 kB; `createConsentController()` alone 1.1 kB. The
consent engine, the event queue, auto-tracking and `debug` logging are part of
`createAnalytics()` whether or not you turn them on.

## Load vendor SDKs on demand

`posthog()` and `sentry()` load `posthog-js` and `@sentry/browser` with a
dynamic `import()`, which your bundler splits into separate chunks, fetched
only when the provider loads. PostHog session recording, Sentry Session
Replay and Sentry tracing are further chunks, fetched only when you turn them
on.

`defer` postpones loading these SDKs until the browser is idle, the first
interaction or a delay, so they don't compete with your page's first load:

```ts
posthog({ apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY, defer: 'idle' })
```

See [Loading SDKs later](/guides/providers/#loading-sdks-later).

The other providers ship no SDK: they inject their vendor's script tag in the
browser, from the vendor's servers, once consent allows it.

## Prefer npm over the script tag

The [script tag](/start/script-tag/) bundles every provider and adapter into
one file, 14.0 kB, because it can't know which ones a page uses. Installed
from npm, you ship only the core and the providers you import.

## Measure your own bundle

To see what ConsentLayer adds to your application, use your bundler's
analyzer, such as
[`@next/bundle-analyzer`](https://www.npmjs.com/package/@next/bundle-analyzer)
or [`rollup-plugin-visualizer`](https://www.npmjs.com/package/rollup-plugin-visualizer)
for Vite, and look for `consentlayer` in the output.
