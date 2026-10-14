<script lang="ts">
  import type { HTMLIframeAttributes } from 'svelte/elements'

  let { containerId, enabled = false, ...rest }: { containerId: string | undefined; enabled?: boolean } & HTMLIframeAttributes = $props()
</script>

{#if enabled && containerId}
  <noscript>
    <iframe
      title="Google Tag Manager"
      height="0"
      width="0"
      style="display:none;visibility:hidden"
      {...rest}
      src="https://www.googletagmanager.com/ns.html?id={encodeURIComponent(containerId)}"
    ></iframe>
  </noscript>
{/if}
