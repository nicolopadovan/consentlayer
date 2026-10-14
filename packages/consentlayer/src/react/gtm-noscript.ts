import { createElement, type ComponentPropsWithoutRef } from 'react'
import { gtmNoscriptSrc } from '../core/noscript'

/**
 * Google Tag Manager's `<noscript>` iframe. It loads the container only for
 * visitors without JavaScript, who never see the consent banner, so its tags
 * run without consent. Render it only where that is lawful for you. Renders
 * nothing without `enabled` or while `containerId` is unset.
 */
export function GtmNoscript(
  props: {
    containerId: string | undefined
    enabled?: boolean
  } & ComponentPropsWithoutRef<'iframe'>,
) {
  const { containerId, enabled, ...iframeProps } = props
  if (!enabled || !containerId) return null
  return createElement(
    'noscript',
    undefined,
    createElement('iframe', {
      title: 'Google Tag Manager',
      ...iframeProps,
      height: iframeProps.height ?? 0,
      width: iframeProps.width ?? 0,
      style: { display: 'none', visibility: 'hidden', ...iframeProps.style },
      src: gtmNoscriptSrc(containerId),
    }),
  )
}
