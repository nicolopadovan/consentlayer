import { withSentryConfig } from 'consentlayer/sentry/next'
import type { NextConfig } from 'next'
import { join } from 'node:path'

const nextConfig: NextConfig = {
  transpilePackages: ['consentlayer'],
  turbopack: { root: join(import.meta.dirname, '../..') },
}

export default withSentryConfig(nextConfig, { silent: true })
