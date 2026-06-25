<script setup lang="ts">
import type { ExamOptionKey, ExamQuestion as ExamQuestionType } from '@/domains/exam/types/exam.types'

import ExamOption from '@/domains/exam/components/ExamOption.vue'

const props = withDefaults(defineProps<{
  index: number
  question: ExamQuestionType
  selectedOption?: ExamOptionKey
  disabled?: boolean
}>(), {
  selectedOption: undefined,
  disabled: false,
})

const emit = defineEmits<{
  (event: 'select', questionId: string, option: ExamOptionKey): void
}>()
</script>

<template>
  <article class="card card--flat section-stack">
    <header class="section-stack section-stack--tight">
      <span class="eyebrow">Question {{ props.index + 1 }}</span>
      <h2 class="question-title">{{ props.question.question }}</h2>
    </header>

    <div :aria-label="`Question ${props.index + 1} options`" role="radiogroup" class="question-options">
      <ExamOption
        v-for="option in props.question.options"
        :key="option.key"
        :option-key="option.key"
        :text="option.text"
        :selected="props.selectedOption === option.key"
        :disabled="props.disabled"
        @select="emit('select', props.question.id, $event)"
      />
    </div>
  </article>
</template>
