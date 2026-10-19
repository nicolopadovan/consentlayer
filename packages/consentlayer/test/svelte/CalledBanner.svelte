<script lang="ts">
  import { untrack } from 'svelte'
  import type { BannerOptions } from '../../src/banner'
  import { useConsentBanner } from '../../src/svelte/banner'

  const props: { options: BannerOptions } = $props()
  useConsentBanner(untrack(() => props.options))
</script>
