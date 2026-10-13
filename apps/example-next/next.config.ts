import { withSentry } from '@nicolopadovan/analytics-consent-manager/sentry/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@nicolopadovan/analytics-consent-manager'],
}

export default withSentry(nextConfig, { silent: true })
