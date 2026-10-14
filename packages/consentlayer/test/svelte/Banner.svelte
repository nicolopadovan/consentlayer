<script lang="ts">
  import { useConsent, useConsentController } from '../../src/svelte'

  const controller = useConsentController()
  const consent = useConsent()
</script>

{#if controller.ready && controller.bannerVisible}
  <button id="accept" onclick={controller.acceptAll}>Accept all</button>
{/if}
<pre>{JSON.stringify(consent.consent)}</pre>
