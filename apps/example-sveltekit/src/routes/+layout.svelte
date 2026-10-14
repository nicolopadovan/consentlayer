<script lang="ts">
  import { FACEBOOK_PIXEL_ID, FACEBOOK_PIXEL_NOSCRIPT } from '$app/env/public'
  import { consentLayer, MetaPixelNoscript } from 'consentlayer/sveltekit'
  import { analytics } from '#lib/analytics.ts'
  import ConsentBanner from '#lib/ConsentBanner.svelte'
  import CookieSettingsButton from '#lib/CookieSettingsButton.svelte'
  import type { LayoutProps } from './$types'

  let { children }: LayoutProps = $props()
  consentLayer({ analytics })
</script>

<main>
  <nav>
    <a href="/">Home</a>
    <a href="/shop?page=2">Shop</a>
  </nav>
  {@render children()}
  <ConsentBanner privacyPolicyUrl="/privacy" />
  <CookieSettingsButton />
  <MetaPixelNoscript pixelId={FACEBOOK_PIXEL_ID} enabled={FACEBOOK_PIXEL_NOSCRIPT} />
</main>
