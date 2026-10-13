'use client'

import { createGlobalError } from 'consentlayer/react'
import { analytics } from '../lib/analytics'

export default createGlobalError(analytics)
