<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  className?: string
}>(), {
  className: '',
})

const attrs = useAttrs()
const className = computed(() =>
  ['button', props.className, attrs.class].filter(Boolean).join(' '),
)
</script>

<template>
  <button v-bind="attrs" :class="className">
    <slot />
  </button>
</template>
