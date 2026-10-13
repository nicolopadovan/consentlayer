import { withSentryConfig } from 'consentlayer/sentry/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['consentlayer'],
}

export default withSentryConfig(nextConfig, { silent: true })
