<script setup lang="ts">
import type { ExamOptionKey } from '@/domains/exam/types/exam.types'

const props = withDefaults(defineProps<{
  optionKey: ExamOptionKey
  text: string
  selected: boolean
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  (event: 'select', option: ExamOptionKey): void
}>()
</script>

<template>
  <button
    type="button"
    :disabled="props.disabled"
    role="radio"
    :aria-checked="props.selected"
    :class="props.selected ? 'button exam-option exam-option--selected' : 'button exam-option'"
    @click="emit('select', props.optionKey)"
  >
    <strong aria-hidden="true">{{ props.optionKey }}</strong>
    <span>{{ props.text }}</span>
  </button>
</template>
