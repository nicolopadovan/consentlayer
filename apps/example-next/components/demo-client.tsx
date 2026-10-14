'use client'

import { productParams } from 'consentlayer/ecommerce'
import { useAnalytics, useConsent } from 'consentlayer/react'

export function DemoClient() {
  const analytics = useAnalytics()
  const { consent } = useConsent()

  return (
    <div className="stack">
      <div className="panel stack">
        <h2>Current consent</h2>
        <pre>{JSON.stringify(consent, null, 2)}</pre>
      </div>
      <div className="panel stack">
        <h2>Identity and event demo</h2>
        <div className="button-row">
          <button
            className="button"
            onClick={async () => {
              await analytics.identify('demo-user', { email: 'demo@example.com' })
              await analytics.track('sign_up', { method: 'example-next' })
            }}
            type="button"
          >
            Identify and track sign_up
          </button>
          <button
            className="button secondary"
            onClick={() =>
              void analytics.track(
                'add_to_cart',
                productParams({
                  id: 'demo-product',
                  variantId: 'demo-variant',
                  title: 'Demo product',
                  quantity: 1,
                  price: { amount: 19.9, currencyCode: 'EUR' },
                }),
              )
            }
            type="button"
          >
            Track add_to_cart
          </button>
          <button
            className="button secondary"
            onClick={() =>
              void analytics.consent.update({
                preferences: true,
                analytics: true,
                marketing: false,
              })
            }
            type="button"
          >
            Force analytics-only consent
          </button>
        </div>
      </div>
    </div>
  )
}
