'use client'

import type { ButtonHTMLAttributes } from 'react'
import { useConsentController } from '../react/consent-controller'

function cx(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function ManageConsentTrigger(
  props: ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { ready, bannerVisible, openDialog } = useConsentController()
  if (!ready || bannerVisible) return null
  const { className, ...rest } = props
  return (
    <button
      {...rest}
      className={cx('acm-manage-trigger', className)}
      type={rest.type ?? 'button'}
      onClick={() => void openDialog()}
    >
      {props.children ?? 'Manage cookies'}
    </button>
  )
}
