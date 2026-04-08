'use client'

import {
  saveIdentity,
  trackAddToCart,
  trackEvent,
  updateConsent,
} from '@nicolopadovan/analytics-consent-manager'
import { useConsent } from '@nicolopadovan/analytics-consent-manager/react'

export function DemoClient() {
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
            onClick={() => {
              saveIdentity({ email: 'demo@example.com' })
              void trackEvent('example_identity_saved', {
                source: 'example-next',
              })
            }}
            type="button"
          >
            Save identity and track
          </button>
          <button
            className="button secondary"
            onClick={() =>
              void trackAddToCart({
                id: 'demo-product',
                variantId: 'demo-variant',
                quantity: 1,
                price: { amount: 19.9, currencyCode: 'EUR' },
              })
            }
            type="button"
          >
            Track AddToCart
          </button>
          <button
            className="button secondary"
            onClick={() =>
              void updateConsent({
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
