<script lang="ts">
  import type { ConsentCategory } from 'consentlayer'
  import { useConsentController } from 'consentlayer/sveltekit'
  import './consent-banner.css'

  let { privacyPolicyUrl }: { privacyPolicyUrl?: string } = $props()

  const labels: Record<ConsentCategory, { label: string; description: string }> = {
    preferences: { label: 'Preferences', description: 'Remember settings such as language or region.' },
    analytics: { label: 'Analytics', description: 'Help us understand how the site is used.' },
    marketing: { label: 'Marketing', description: 'Measure our ads and show relevant ones on other sites.' },
  }

  const consent = useConsentController()
</script>

{#if consent.ready && consent.dialogVisible}
  <div class="consent-dialog" role="dialog" aria-labelledby="consent-dialog-title">
    <h2 id="consent-dialog-title">Cookie settings</h2>
    <label>
      <input type="checkbox" checked disabled />
      <span><strong>Necessary</strong> Needed for the site to work, such as remembering this choice. Always on.</span>
    </label>
    {#each consent.categories as key (key)}
      <label>
        <input
          type="checkbox"
          checked={consent.prefs[key]}
          onchange={(event) => consent.setPrefs({ ...consent.prefs, [key]: event.currentTarget.checked })}
        />
        <span><strong>{labels[key].label}</strong> {labels[key].description}</span>
      </label>
    {/each}
    <div class="consent-actions">
      <button type="button" onclick={consent.closeDialog}>Close</button>
      <button type="button" class="primary" onclick={consent.savePreferences}>Save</button>
    </div>
  </div>
{:else if consent.ready && consent.bannerVisible}
  <div class="consent-banner" role="dialog" aria-labelledby="consent-banner-title">
    <h2 id="consent-banner-title">Cookies</h2>
    <p>
      We use cookies to run this site and, with your consent, for preferences, analytics and marketing.
      {#if privacyPolicyUrl}<a href={privacyPolicyUrl}>Privacy policy</a>{/if}
    </p>
    <div class="consent-actions">
      <button type="button" onclick={consent.rejectNonEssential}>Reject non-essential</button>
      <button type="button" onclick={consent.openDialog}>Customize</button>
      <button type="button" class="primary" onclick={consent.acceptAll}>Accept all</button>
    </div>
  </div>
{/if}
