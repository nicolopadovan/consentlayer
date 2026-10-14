<script lang="ts">
  import { useConsent, useConsentController } from 'consentlayer/sveltekit'

  const controller = useConsentController()
  const consent = useConsent()
</script>

{#if controller.ready}
  <pre>{JSON.stringify(consent.consent, null, 2)}</pre>
{/if}
