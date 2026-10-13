import { sentryInstrumentation } from '@nicolopadovan/analytics-consent-manager/sentry/server'

export const { register, onRequestError } = sentryInstrumentation({ dsn: process.env.SENTRY_DSN })
