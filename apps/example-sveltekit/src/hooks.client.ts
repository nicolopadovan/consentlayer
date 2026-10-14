import type { HandleClientError } from '@sveltejs/kit/hooks'
import { analytics } from '#lib/analytics.ts'

export const handleError: HandleClientError = ({ kind, error }) => {
  if (kind === 'unknown') void analytics.captureError(error, { source: 'boundary' })
}
