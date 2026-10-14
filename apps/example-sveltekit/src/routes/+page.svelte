<script lang="ts">
  import { useAnalytics } from 'consentlayer/svelte'
  import ConsentState from '#lib/ConsentState.svelte'

  const analytics = useAnalytics()
</script>

<section>
  <h1>ConsentLayer with SvelteKit</h1>
  <button type="button" onclick={() => analytics.track('sign_up', { method: 'email' })}>Track sign_up</button>
  <ConsentState />
</section>
