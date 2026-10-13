'use client'

import { createGlobalError } from '@nicolopadovan/analytics-consent-manager/react'
import { analytics } from '../lib/analytics'

export default createGlobalError(analytics)
