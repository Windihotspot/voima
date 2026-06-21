<script setup lang="ts">
import { RouterView } from 'vue-router'

console.log('CURRENT ROUTE:', window.location.hash)
</script>

<template>
  <RouterView />
</template>
