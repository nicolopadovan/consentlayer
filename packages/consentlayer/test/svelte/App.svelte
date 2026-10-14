<script lang="ts">
  import { untrack } from 'svelte'
  import type { Analytics } from '../../src/core/types'
  import { consentLayer, type AfterNavigateLike } from '../../src/svelte'
  import Banner from './Banner.svelte'

  const props: { analytics: Analytics; afterNavigate?: AfterNavigateLike } = $props()
  consentLayer(untrack(() => ({ analytics: props.analytics, afterNavigate: props.afterNavigate })))
</script>

<Banner />
