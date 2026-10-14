<script lang="ts">
  import { afterNavigate } from '$app/navigation'
  import { consentLayer } from 'consentlayer/svelte'
  import { analytics } from '#lib/analytics.ts'
  import ConsentBanner from '#lib/ConsentBanner.svelte'
  import CookieSettingsButton from '#lib/CookieSettingsButton.svelte'
  import type { LayoutProps } from './$types'

  let { children }: LayoutProps = $props()
  consentLayer({ analytics, afterNavigate })
</script>

<main>
  <nav>
    <a href="/">Home</a>
    <a href="/shop?page=2">Shop</a>
  </nav>
  {@render children()}
  <ConsentBanner privacyPolicyUrl="/privacy" />
  <CookieSettingsButton />
</main>
