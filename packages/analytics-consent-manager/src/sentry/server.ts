import { captureRequestError, init } from '@sentry/nextjs'

export type SentryServerOptions = {
  dsn: string | undefined
  environment?: string
  release?: string
  /** Performance tracing sample rate. Off by default. */
  tracesSampleRate?: number
}

/**
 * Sentry for Next.js server and edge code, without personal data.
 *
 * ```ts
 * // instrumentation.ts
 * export const { register, onRequestError } = sentryInstrumentation({ dsn: process.env.SENTRY_DSN })
 * ```
 */
export function sentryInstrumentation(options: SentryServerOptions) {
  return {
    register: () => {
      if (!options.dsn) return
      init({
        dsn: options.dsn,
        environment: options.environment,
        release: options.release,
        tracesSampleRate: options.tracesSampleRate,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
      })
    },
    onRequestError: captureRequestError,
  }
}
