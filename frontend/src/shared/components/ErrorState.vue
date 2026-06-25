<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <div class="callout callout--danger" role="alert">
    {{ message }}
  </div>
</template>
