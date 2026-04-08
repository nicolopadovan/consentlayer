import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../components/analytics-shell', () => ({
  AnalyticsShell: (props: { children: React.ReactNode }) => <>{props.children}</>,
}))

vi.mock('next/script', () => ({
  default: (props: { src: string }) => <script src={props.src} />,
}))

describe('RootLayout', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.assign(process.env, {
      NEXT_PUBLIC_FACEBOOK_PIXEL_ID: '123456',
      NEXT_PUBLIC_FACEBOOK_PIXEL_NOSCRIPT: 'true',
    })
  })

  it('renders optional Meta noscript markup', async () => {
    const { default: RootLayout } = await import('./layout')
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    )

    expect(html).toContain('facebook.com/tr?id=123456')
    expect(html).toContain('consent-tracking-api')
    expect(html).toContain('child')
  })
})
