<script setup lang="ts">
const props = withDefaults(defineProps<{
  className?: string
}>(), {
  className: '',
})
</script>

<template>
  <div :class="props.className ? `card ${props.className}` : 'card'">
    <slot />
  </div>
</template>
