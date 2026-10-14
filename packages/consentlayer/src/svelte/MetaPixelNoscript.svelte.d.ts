import type { Component } from 'svelte'
import type { HTMLImgAttributes } from 'svelte/elements'

declare const MetaPixelNoscript: Component<{ pixelId: string | undefined; enabled?: boolean } & HTMLImgAttributes>
export default MetaPixelNoscript
