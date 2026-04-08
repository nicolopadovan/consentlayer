import {
  createEnvConfig,
} from '@nicolopadovan/analytics-consent-manager'
import { MetaPixelNoscript } from '@nicolopadovan/analytics-consent-manager/providers/meta'
import { getShopifyCustomerPrivacyScriptUrl } from '@nicolopadovan/analytics-consent-manager/providers/shopify'
import Script from 'next/script'
import { Suspense, type ReactNode } from 'react'
import { AnalyticsShell } from '../components/analytics-shell'
import './globals.css'

const env = createEnvConfig(process.env)

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className="shell">
        <Script
          src={getShopifyCustomerPrivacyScriptUrl()}
          strategy="lazyOnload"
        />
        {env.meta.pixelId ? (
          <MetaPixelNoscript
            enabled={env.meta.noscriptEnabled}
            pixelId={env.meta.pixelId}
          />
        ) : null}
        <Suspense fallback={null}>
          <AnalyticsShell env={env}>{children}</AnalyticsShell>
        </Suspense>
      </body>
    </html>
  )
}
