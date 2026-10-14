<script lang="ts">
  import { useConsentController } from 'consentlayer/sveltekit'

  const consent = useConsentController()
</script>

{#if consent.ready && !consent.bannerVisible}
  <button type="button" onclick={consent.openDialog}>Cookie settings</button>
{/if}
