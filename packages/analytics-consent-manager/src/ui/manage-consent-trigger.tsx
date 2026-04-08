'use client'

import type { ButtonHTMLAttributes } from 'react'
import { useConsentController } from '../react/consent-controller'

export function ManageConsentTrigger(
  props: ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { ready, bannerVisible, openDialog } = useConsentController()
  if (!ready || bannerVisible) return null
  return (
    <button {...props} type={props.type ?? 'button'} onClick={() => void openDialog()}>
      {props.children ?? 'Manage cookies'}
    </button>
  )
}
