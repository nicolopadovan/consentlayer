import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
import { useConsentController } from 'consentlayer/react'
import { AnalyticsProvider } from 'consentlayer/tanstack-start'
import type { ReactNode } from 'react'
import { analytics } from '../lib/analytics'
import { ConsentBanner } from '../lib/consent-banner'

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  }),
  shellComponent: RootDocument,
  component: Root,
})

function CookieSettingsButton() {
  const { ready, bannerVisible, openDialog } = useConsentController()
  if (!ready || bannerVisible) return null
  return (
    <button type="button" onClick={openDialog}>
      Cookie settings
    </button>
  )
}

function Root() {
  return (
    <AnalyticsProvider analytics={analytics}>
      <main>
        <nav>
          <Link to="/">Home</Link>{' '}
          <Link to="/shop" search={{ page: 2 }}>
            Shop
          </Link>
        </nav>
        <Outlet />
        <ConsentBanner privacyPolicyUrl="/privacy" />
        <CookieSettingsButton />
      </main>
    </AnalyticsProvider>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
