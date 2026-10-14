import { defineEnvVars } from '@sveltejs/kit/env'
import type { DebugOptions } from 'consentlayer'

export const variables = defineEnvVars({
  GA4_MEASUREMENT_ID: { public: true, schema: (value) => value ?? '' },
  FACEBOOK_PIXEL_ID: { public: true, schema: (value) => value ?? '' },
  FACEBOOK_PIXEL_NOSCRIPT: { public: true, schema: (value) => value === 'true' },
  ENABLE_ANALYTICS: { public: true, schema: (value) => value === 'true' },
  ANALYTICS_DEBUG: {
    public: true,
    schema: (value): boolean | DebugOptions => (value ? (JSON.parse(value) as boolean | DebugOptions) : false),
  },
})
