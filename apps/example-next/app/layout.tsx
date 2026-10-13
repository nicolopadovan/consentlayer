import { MetaPixelNoscript } from 'consentlayer/react'
import { getShopifyCustomerPrivacyScriptUrl } from 'consentlayer/providers/shopify'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { AnalyticsShell } from '../components/analytics-shell'
import './globals.css'

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
        <MetaPixelNoscript
          enabled={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT === 'true'}
          pixelId={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID}
        />
        <AnalyticsShell>{children}</AnalyticsShell>
      </body>
    </html>
  )
}
