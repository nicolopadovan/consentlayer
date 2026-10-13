import {
  createEnvConfig,
} from 'consentlayer'
import { MetaPixelNoscript } from 'consentlayer/providers/meta'
import { getShopifyCustomerPrivacyScriptUrl } from 'consentlayer/providers/shopify'
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
          <AnalyticsShell>{children}</AnalyticsShell>
        </Suspense>
      </body>
    </html>
  )
}
