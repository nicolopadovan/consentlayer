<script lang="ts">
  import type { HTMLImgAttributes } from 'svelte/elements'

  let { pixelId, enabled = false, ...rest }: { pixelId: string | undefined; enabled?: boolean } & HTMLImgAttributes = $props()
</script>

{#if enabled && pixelId}
  <noscript>
    <img
      height="1"
      width="1"
      style="display:none"
      {...rest}
      alt=""
      src="https://www.facebook.com/tr?id={encodeURIComponent(pixelId)}&ev=PageView&noscript=1"
    />
  </noscript>
{/if}
