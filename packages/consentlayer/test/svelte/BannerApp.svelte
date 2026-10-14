<script lang="ts">
  import { untrack } from 'svelte'
  import type { BannerOptions } from '../../src/banner'
  import type { Analytics } from '../../src/core/types'
  import { consentLayer } from '../../src/svelte'
  import { consentBanner } from '../../src/svelte/banner'
  import CalledBanner from './CalledBanner.svelte'

  const props: {
    analytics: Analytics
    options: BannerOptions
    called?: boolean
    controls: { hide?: () => void; setOptions?: (options: BannerOptions) => void }
  } = $props()
  consentLayer(untrack(() => ({ analytics: props.analytics })))

  let options = $state(untrack(() => props.options))
  let shown = $state(true)
  untrack(() => {
    props.controls.hide = () => (shown = false)
    props.controls.setOptions = (next) => (options = next)
  })
</script>

{#if shown}
  {#if props.called}
    <CalledBanner {options} />
  {:else}
    <div use:consentBanner={options}></div>
  {/if}
{/if}
