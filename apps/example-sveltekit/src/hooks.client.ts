import { handleErrorWith } from 'consentlayer/sveltekit'
import { analytics } from '#lib/analytics.ts'

export const handleError = handleErrorWith(analytics)
