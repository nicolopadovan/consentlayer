---
title: Google Tag Manager
description: "gtm() loads a Google Tag Manager container after the Consent Mode defaults and feeds it page views, events, the user ID and consent."
---

`gtm()` from `consentlayer/providers/gtm` loads a Google Tag Manager web
container and pushes page views, events, the user ID and every consent change
into `dataLayer`, where your GTM triggers and variables read them.

```ts
import { gtm } from 'consentlayer/providers/gtm'

gtm({ containerId: process.env.NEXT_PUBLIC_GTM_ID })
```

:::caution[Track each tool in one place]
Configure each tool either in ConsentLayer or as a tag in GTM, never both.
With `ga4()` in ConsentLayer and a Google Analytics tag in the container, or
`meta()` and a Meta Pixel tag, every page view and event is counted twice.
Use GTM for the tags ConsentLayer has no provider for.
:::

## Options

| Option               | Type                   | Default    | Description                                                                                                                         |
| -------------------- | ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `containerId`        | `string \| undefined`  | Required   | The `GTM-` container ID. `undefined` or `''` turns the provider off.                                                                |
| `requiredConsent`    | `'none'` or a category | `'none'`   | `'none'` loads the container at boot. A category, such as `'analytics'`, loads nothing until it is granted.                         |
| `serverContainerUrl` | `string`               | None       | Your tagging server. `gtm.js` loads from it instead of `www.googletagmanager.com`. See [Server-side tagging](#server-side-tagging). |
| `events`             | `string[] \| false`    | All events | The event names `track()` sends to it; `false` sends none. See [Routing events](/guides/events/#routing-events).                    |

## How it works

At setup, when `createAnalytics()` creates the instance in the browser,
`gtm()` sets the same Consent Mode v2 defaults as
[`ga4()`](/guides/providers/ga4/#how-it-works), all denied except
`security_storage`, and sends `gtag('consent', 'update')` on each choice. With
both `ga4()` and `gtm()`, the defaults and updates are sent once. With the
[Google Consent Mode adapter](/guides/adapters/google-consent-mode/), `gtm()`
leaves them to it.

At boot, `gtm()` pushes `{ 'gtm.start': <time>, event: 'gtm.js' }` and loads
`https://www.googletagmanager.com/gtm.js?id=<containerId>`, as Google's install
snippet does. The container loads before the visitor chooses, so each tag in
it must respect consent: Google tags read the Consent Mode signals, and other
tags need a consent check in GTM, such as a trigger on the
`consentlayer_consent` event. To load nothing before consent, pass
`requiredConsent: 'analytics'`; Google tags then send no cookieless pings
before the choice.

Then `gtm()` pushes these messages:

| Call                                                  | `dataLayer` message                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `page()`                                              | `{ event: 'page_view', page_location, page_path, page_title }`                         |
| `track(name, params, options)`                        | `{ ...params, ...options.providers.gtm, event: name }`                                 |
| A consent change                                      | `{ event: 'consentlayer_consent', consent: { preferences, analytics, marketing, … } }` |
| `identify()`, and analytics granted with a known user | `{ event: 'consentlayer_identify', user_id }`                                          |
| `reset()`, or analytics withdrawn                     | `{ event: 'consentlayer_identify', user_id: null }`                                    |

In a `track()` message, `event` is always the event name: a `params` or
`options.providers.gtm` key named `event` is overwritten.

The user ID is pushed only while `analytics` is granted. The email address
and phone number are never pushed, since every tag in the container can read
`dataLayer`. A failed `gtm.js` load is reported to `onError` with scope
`provider-script-load`.

## Server-side tagging

With a [server-side GTM](https://developers.google.com/tag-platform/tag-manager/server-side)
container, `serverContainerUrl` loads `gtm.js` from your tagging server, on
your own domain:

```ts
gtm({ containerId: process.env.NEXT_PUBLIC_GTM_ID, serverContainerUrl: 'https://sgtm.example.com' })
```

The server container needs the Google Tag Manager: Web Container client, with
your container ID allowed. Where the tags in the web container send their
hits is set in GTM, through each Google tag's `server_container_url`. To send
events from your server to the container, see
[Server-side GTM](/guides/server-side-tracking/#server-side-gtm).

## Without JavaScript

`<GtmNoscript>` from `consentlayer/react`, `consentlayer/vue`,
`consentlayer/svelte`, `consentlayer/sveltekit`, `consentlayer/solid` or
`consentlayer/solidstart` renders GTM's `<noscript>` iframe; the Nuxt module
registers it, and `provideGtmNoscript()` from `consentlayer/angular` adds it
at the start of `<body>`. It renders nothing without `enabled` or while
`containerId` is `undefined` or empty.

```tsx
<GtmNoscript containerId={process.env.NEXT_PUBLIC_GTM_ID} enabled />
```

The iframe loads the container for visitors without JavaScript, who never see
a banner, so its tags run without consent. Enable it only where that is
lawful for you.

On a page without a framework, such as one using the
[script tag](/start/script-tag/), add Google's markup at the start of
`<body>` yourself, under the same condition:

```html
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```
