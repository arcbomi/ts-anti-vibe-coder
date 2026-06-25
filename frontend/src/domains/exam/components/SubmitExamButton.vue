<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  isSubmitting?: boolean
  answeredCount: number
  totalCount: number
  submitted?: boolean
}>(), {
  disabled: false,
  isSubmitting: false,
  submitted: false,
})

const emit = defineEmits<{
  (event: 'submit'): void
}>()

const isDisabled = computed(() => props.disabled || props.isSubmitting || props.submitted)
</script>

<template>
  <div class="section-stack section-stack--tight">
    <span class="field-hint">{{ props.answeredCount }} / {{ props.totalCount }} answered</span>
    <button
      type="button"
      class="button button--primary button--wide"
      :disabled="isDisabled"
      @click="emit('submit')"
    >
      {{ props.isSubmitting ? 'Submitting answers...' : props.submitted ? 'Exam submitted' : 'Submit exam' }}
    </button>
  </div>
</template>
