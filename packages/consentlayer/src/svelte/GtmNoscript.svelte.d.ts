import type { Component } from 'svelte'
import type { HTMLIframeAttributes } from 'svelte/elements'

declare const GtmNoscript: Component<{ containerId: string | undefined; enabled?: boolean } & HTMLIframeAttributes>
export default GtmNoscript
