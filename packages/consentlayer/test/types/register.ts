import { createAnalytics } from 'consentlayer'
import { meta } from 'consentlayer/providers/meta'

declare module 'consentlayer' {
  interface Register {
    events: { quote_requested: { value: number; currency: string } }
  }
}

const analytics = createAnalytics({
  providers: [meta({ pixelId: undefined, events: ['purchase', 'quote_requested'] })],
})

void analytics.track('quote_requested', { value: 10, currency: 'EUR' })
void analytics.track('purchase', { transaction_id: 'T-1' })
void analytics.track('consentlayer.scroll_depth')
// @ts-expect-error undeclared events are rejected
void analytics.track('quote_requestd')
// @ts-expect-error declared params are checked
void analytics.track('quote_requested', { value: '10', currency: 'EUR' })
// @ts-expect-error provider event lists are checked
meta({ pixelId: undefined, events: ['quote_requestd'] })
