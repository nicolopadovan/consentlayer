<script setup lang="ts">
import { useAnalytics } from 'consentlayer/vue'

const analytics = useAnalytics()
</script>

<template>
  <section>
    <h1>ConsentLayer with Nuxt</h1>
    <button type="button" @click="analytics.track('sign_up', { method: 'email' })">Track sign_up</button>
    <ClientOnly><ConsentState /></ClientOnly>
  </section>
</template>
