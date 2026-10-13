import { createAnalyticsHandler } from 'consentlayer/server'
import { metaCapi } from 'consentlayer/server/meta'

export const POST = createAnalyticsHandler({
  destinations: [
    metaCapi({
      pixelId: process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID,
      accessToken: process.env.META_TOKEN,
      testEventCode: process.env.FACEBOOK_TEST_EVENT_CODE,
    }),
  ],
  onError: console.error,
})
