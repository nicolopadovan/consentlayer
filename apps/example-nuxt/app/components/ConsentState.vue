<script setup lang="ts">
import { useConsent } from 'consentlayer/vue'

const { consent } = useConsent()
</script>

<template>
  <pre>{{ JSON.stringify(consent, null, 2) }}</pre>
</template>
