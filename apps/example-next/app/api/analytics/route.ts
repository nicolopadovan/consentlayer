import { createAnalyticsHandler } from '@nicolopadovan/analytics-consent-manager/server'
import { metaCapi } from '@nicolopadovan/analytics-consent-manager/server/meta'

export const runtime = 'nodejs'

const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID
const accessToken = process.env.META_TOKEN

export const POST = createAnalyticsHandler({
  destinations:
    pixelId && accessToken
      ? [metaCapi({ pixelId, accessToken, testEventCode: process.env.FACEBOOK_TEST_EVENT_CODE })]
      : [],
  onError: console.error,
})
