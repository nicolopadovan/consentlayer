import type { PostHog } from 'posthog-js'
import { definePlugin, skippedPlugin } from '../core/plugin'
import type { LoadTiming, PluginContext } from '../core/types'

/** Options for `posthog`. */
export type PostHogOptions = {
  /** `undefined` or `''` turns the provider off. */
  apiKey: string | undefined
  /** Defaults to `https://us.i.posthog.com`. */
  apiHost?: string
  /** PostHog's app URL, for toolbar links when `apiHost` is a reverse proxy, e.g. `https://us.posthog.com`. */
  uiHost?: string
  /**
   * Counts visitors without cookies or storage until analytics is granted, then
   * switches to cookies. Needs cookieless mode on in the PostHog project settings.
   * `false` loads PostHog only after analytics consent. Defaults to `true`.
   */
  cookieless?: boolean
  /** Defaults to `false`. */
  autocapture?: boolean
  /** Session recording, after analytics consent. Defaults to `false`. */
  recording?: boolean
  /** Sends `captureError` errors to PostHog error tracking. Defaults to `true`. */
  errors?: boolean
  /** The group type `group()` uses. Defaults to `company`. */
  groupType?: string
  defer?: LoadTiming
}

/** PostHog product analytics, cookieless until analytics consent. */
export function posthog(options: PostHogOptions) {
  const apiKey = options.apiKey?.trim()
  if (!apiKey) return skippedPlugin('posthog', 'apiKey')
  const cookieless = options.cookieless ?? true
  let ready: Promise<PostHog> | undefined
  let latest: PluginContext | undefined
  const granted = () => Boolean(latest?.consent?.analytics)

  const apply = async (client: PostHog) => {
    if (!granted()) {
      if (!client.has_opted_out_capturing()) client.opt_out_capturing()
      return
    }
    if (!client.has_opted_in_capturing()) client.opt_in_capturing()
    const userId = latest?.identity.userId
    if (userId) client.identify(userId)
    if (options.recording) {
      await import('posthog-js/dist/posthog-recorder')
      client.startSessionRecording()
    }
  }

  return definePlugin({
    id: 'posthog',
    requiredConsent: cookieless ? 'none' : 'analytics',
    defer: options.defer,
    async consent(ctx) {
      latest = ctx
      if (ready) await apply(await ready)
    },
    async load(ctx) {
      latest ??= ctx
      ready = import('posthog-js').then(({ default: client }) => {
        client.init(apiKey, {
          api_host: options.apiHost ?? 'https://us.i.posthog.com',
          ui_host: options.uiHost,
          cookieless_mode: cookieless ? 'on_reject' : undefined,
          opt_out_capturing_by_default: true,
          opt_out_persistence_by_default: true,
          autocapture: options.autocapture ?? false,
          capture_pageview: false,
          capture_pageleave: false,
          capture_exceptions: false,
          capture_heatmaps: false,
          capture_dead_clicks: false,
          disable_session_recording: true,
          disable_surveys: true,
          advanced_disable_flags: !options.recording,
          advanced_disable_feature_flags: true,
          disable_external_dependency_loading: true,
        })
        return client
      })
      await apply(await ready)
    },
    async page(page) {
      const client = await ready
      client?.capture('$pageview', { $current_url: page.url, title: page.title })
    },
    async track(event) {
      const client = await ready
      client?.capture(event.name, { ...event.params, ...event.options.providers?.posthog })
    },
    async identify(identity, traits, ctx) {
      latest = ctx
      const client = await ready
      if (!client || !granted() || !identity.userId) return
      client.identify(identity.userId, identity.email ? { ...traits, email: identity.email } : traits)
    },
    async group(groupId, traits) {
      const client = await ready
      if (client && granted()) client.group(options.groupType ?? 'company', groupId, traits)
    },
    async reset(ctx) {
      latest = ctx
      const client = await ready
      if (!client) return
      client.reset()
      await apply(client)
    },
    error:
      options.errors === false
        ? undefined
        : async (error, context) => {
            const client = await ready
            client?.captureException(error, { level: context.level, ...context.tags, ...context.extra })
          },
  })
}
