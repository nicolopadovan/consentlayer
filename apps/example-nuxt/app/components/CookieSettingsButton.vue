<script setup lang="ts">
import { useConsentController } from 'consentlayer/vue'

const { bannerVisible, openDialog } = useConsentController()
</script>

<template>
  <button v-if="!bannerVisible" type="button" @click="openDialog">Cookie settings</button>
</template>
