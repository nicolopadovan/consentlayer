import { sentryInstrumentation } from 'consentlayer/sentry/server'

export const { register, onRequestError } = sentryInstrumentation({ dsn: process.env.SENTRY_DSN })
