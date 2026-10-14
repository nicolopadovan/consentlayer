<script setup lang="ts">
import type { ConsentCategory } from 'consentlayer'
import { useConsentController } from 'consentlayer/vue'
import './consent-banner.css'

defineProps<{ privacyPolicyUrl?: string }>()

const labels: Record<ConsentCategory, { label: string; description: string }> = {
  preferences: { label: 'Preferences', description: 'Remember settings such as language or region.' },
  analytics: { label: 'Analytics', description: 'Help us understand how the site is used.' },
  marketing: { label: 'Marketing', description: 'Measure our ads and show relevant ones on other sites.' },
}

const {
  ready, bannerVisible, dialogVisible, categories, prefs,
  setPrefs, openDialog, closeDialog, acceptAll, rejectNonEssential, savePreferences,
} = useConsentController()
</script>

<template>
  <section v-if="ready && dialogVisible" class="consent-dialog" role="dialog" aria-labelledby="consent-dialog-title">
    <h2 id="consent-dialog-title">Cookie settings</h2>
    <label>
      <input type="checkbox" checked disabled>
      <span><strong>Necessary</strong> Needed for the site to work, such as remembering this choice. Always on.</span>
    </label>
    <label v-for="key in categories" :key="key">
      <input
        type="checkbox"
        :checked="prefs[key]"
        @change="setPrefs({ ...prefs, [key]: ($event.target as HTMLInputElement).checked })"
      >
      <span><strong>{{ labels[key].label }}</strong> {{ labels[key].description }}</span>
    </label>
    <div class="consent-actions">
      <button type="button" @click="closeDialog">Close</button>
      <button type="button" class="primary" @click="savePreferences">Save</button>
    </div>
  </section>
  <section v-else-if="ready && bannerVisible" class="consent-banner" role="dialog" aria-labelledby="consent-banner-title">
    <h2 id="consent-banner-title">Cookies</h2>
    <p>
      We use cookies to run this site and, with your consent, for preferences, analytics and marketing.
      <a v-if="privacyPolicyUrl" :href="privacyPolicyUrl">Privacy policy</a>
    </p>
    <div class="consent-actions">
      <button type="button" @click="rejectNonEssential">Reject non-essential</button>
      <button type="button" @click="openDialog">Customize</button>
      <button type="button" class="primary" @click="acceptAll">Accept all</button>
    </div>
  </section>
</template>
