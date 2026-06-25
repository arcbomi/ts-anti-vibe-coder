<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<template>
  <div class="callout callout--neutral" aria-live="polite" aria-busy="true">
    {{ label ?? 'Loading...' }}
  </div>
</template>
