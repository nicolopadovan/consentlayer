'use client'

import type { ButtonHTMLAttributes } from 'react'
import { ui } from '../core/names'
import { useConsentController } from '../react/consent-controller'
import { useConsentMessages } from './messages'

function cx(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function ManageConsentTrigger(
  props: ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { ready, bannerVisible, openDialog } = useConsentController()
  const { messages } = useConsentMessages()
  if (!ready || bannerVisible) return null
  const { className, ...rest } = props
  return (
    <button
      {...rest}
      className={cx(ui('manage-trigger'), className)}
      type={rest.type ?? 'button'}
      onClick={() => void openDialog()}
    >
      {props.children ?? messages.manage}
    </button>
  )
}
