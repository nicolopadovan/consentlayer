import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { AnalyticsProvider, ErrorBoundary, MetaPixelNoscript } from 'consentlayer/solidstart'
import { Suspense } from 'solid-js'
import { analytics } from '~/lib/analytics'
import { ConsentBanner } from '~/lib/ConsentBanner'
import { CookieSettingsButton } from '~/lib/CookieSettingsButton'

export default function App() {
  return (
    <Router
      root={(props) => (
        <AnalyticsProvider analytics={analytics}>
          <main>
            <nav>
              <a href="/">Home</a> <a href="/shop?page=2">Shop</a>
            </nav>
            <ErrorBoundary fallback={<p>Something went wrong.</p>}>
              <Suspense>{props.children}</Suspense>
            </ErrorBoundary>
            <ConsentBanner privacyPolicyUrl="/privacy" />
            <CookieSettingsButton />
            <MetaPixelNoscript
              pixelId={import.meta.env.VITE_FACEBOOK_PIXEL_ID}
              enabled={import.meta.env.VITE_FACEBOOK_PIXEL_NOSCRIPT === 'true'}
            />
          </main>
        </AnalyticsProvider>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
