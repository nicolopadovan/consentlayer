import { createElement, type ComponentPropsWithoutRef } from 'react'

/**
 * Meta's `<noscript>` PageView pixel. It fires only for visitors without
 * JavaScript, who never see the consent banner, so it tracks them without
 * consent. Render it only where that is lawful for you. Renders nothing without
 * `enabled` or while `pixelId` is unset.
 */
export function MetaPixelNoscript(
  props: {
    pixelId: string | undefined
    enabled?: boolean
  } & ComponentPropsWithoutRef<'img'>,
) {
  const { pixelId, enabled, ...imageProps } = props
  if (!enabled || !pixelId) return null
  return createElement(
    'noscript',
    undefined,
    createElement('img', {
      ...imageProps,
      alt: '',
      height: imageProps.height ?? 1,
      width: imageProps.width ?? 1,
      style: { display: 'none', ...imageProps.style },
      src: `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`,
    }),
  )
}
