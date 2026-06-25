<script setup lang="ts">
import type { OptionKey } from '@/domains/question/types/question.types'
import Button from '@/shared/components/Button.vue'

const props = withDefaults(defineProps<{
  optionKey: OptionKey
  text: string
  selected: boolean
  disabled?: boolean
}>(), {
  disabled: false,
})

defineEmits<{
  (event: 'select', option: OptionKey): void
}>()
</script>

<template>
  <Button
    type="button"
    :disabled="props.disabled"
    :aria-pressed="props.selected"
    @click="$emit('select', props.optionKey)"
    :style="{
      width: '100%',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'flex-start',
      padding: '0.875rem 1rem',
      borderRadius: '12px',
      border: props.selected ? '1px solid var(--accent)' : '1px solid var(--border)',
      background: props.selected ? 'var(--accent-soft)' : 'transparent',
      color: 'var(--headline)',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      textAlign: 'left',
      opacity: props.disabled ? '0.7' : '1',
    }"
  >
    <strong aria-hidden="true">{{ props.optionKey }}</strong>
    <span>{{ props.text }}</span>
  </Button>
</template>
