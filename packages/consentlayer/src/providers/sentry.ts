import type { replayIntegration } from '@sentry/browser'
import { definePlugin } from '../core/plugin'
import type { LoadTiming, PluginContext } from '../core/types'

type Replay = ReturnType<typeof replayIntegration>

/** Options for `sentry`. */
export type SentryOptions = {
  dsn: string
  environment?: string
  release?: string
  /** Session Replay, after analytics consent. Defaults to `false`. */
  replay?: boolean | { sessionSampleRate?: number; onErrorSampleRate?: number }
  /** Performance tracing, after analytics consent. Defaults to `false`. */
  tracing?: boolean | { sampleRate?: number }
  /** Sends events to this URL instead of the DSN's host, so ad blockers don't drop them. */
  tunnel?: string
  defer?: LoadTiming
}

/**
 * Errors are sent without consent and without personal data (no IP, cookies,
 * headers, bodies or query strings). Analytics consent adds the user id (and
 * email, with marketing), Replay and tracing.
 */
export function sentry(options: SentryOptions) {
  const replay = options.replay === true ? {} : options.replay
  const tracing = options.tracing === true ? {} : options.tracing
  let ready: Promise<typeof import('./sentry-sdk')> | undefined
  let latest: PluginContext | undefined
  let replayIntegration: Replay | undefined
  let tracingAdded = false
  const granted = () => Boolean(latest?.consent?.analytics)

  const apply = async (sdk: typeof import('./sentry-sdk')) => {
    const userId = latest?.identity.userId
    sdk.setUser(granted() && userId ? { id: userId, email: latest?.identity.email } : null)
    if (replay) {
      if (!granted()) await replayIntegration?.stop()
      else if (replayIntegration) replayIntegration.startBuffering() // ponytail: a regrant buffers for errors only; sessions resume next page load
      else sdk.addIntegration((replayIntegration = (await import('./sentry-replay')).replayIntegration() ))
    }
    if (tracing && granted() && !tracingAdded) {
      tracingAdded = true
      sdk.addIntegration((await import('./sentry-tracing')).browserTracingIntegration())
    }
  }

  return definePlugin({
    id: 'sentry',
    requiredConsent: 'none',
    defer: options.defer,
    async consent(ctx) {
      latest = ctx
      if (ready) await apply(await ready)
    },
    async load(ctx) {
      latest ??= ctx
      ready = import('./sentry-sdk').then((sdk) => {
        sdk.init({
          dsn: options.dsn,
          environment: options.environment,
          release: options.release,
          tunnel: options.tunnel,
          dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
          },
          integrations: (defaults) => defaults.filter((integration) => integration.name !== 'GlobalHandlers'),
          tracesSampleRate: tracing ? (tracing.sampleRate ?? 1) : undefined,
          replaysSessionSampleRate: replay ? (replay.sessionSampleRate ?? 0.1) : undefined,
          replaysOnErrorSampleRate: replay ? (replay.onErrorSampleRate ?? 1) : undefined,
          beforeSendTransaction: (event) => (granted() ? event : null),
        })
        return sdk
      })
      await apply(await ready)
    },
    async identify(_identity, _traits, ctx) {
      latest = ctx
      const sdk = await ready
      if (sdk) await apply(sdk)
    },
    async reset(ctx) {
      latest = ctx
      ;(await ready)?.setUser(null)
    },
    async error(error, context) {
      ;(await ready)?.captureException(error, {
        level: context.level,
        tags: { ...context.tags, source: context.source },
        extra: context.extra,
      })
    },
  })
}
