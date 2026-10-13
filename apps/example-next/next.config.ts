import { withSentry } from 'consentlayer/sentry/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['consentlayer'],
}

export default withSentry(nextConfig, { silent: true })
