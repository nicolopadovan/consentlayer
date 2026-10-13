import { MetaPixelNoscript } from 'consentlayer/react'
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
        <MetaPixelNoscript
          enabled={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT === 'true'}
          pixelId={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID}
        />
        <AnalyticsShell>{children}</AnalyticsShell>
      </body>
    </html>
  )
}
