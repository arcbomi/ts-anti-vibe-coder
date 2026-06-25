<script setup lang="ts">
import type { ExamQuestion, OptionKey } from '@/domains/question/types/question.types'

import QuestionCard from '@/domains/question/components/QuestionCard.vue'

const props = withDefaults(defineProps<{
  questions: ExamQuestion[]
  selectedAnswers: Record<string, OptionKey>
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  (event: 'selectAnswer', questionId: string, option: OptionKey): void
}>()

function handleSelect(questionId: string, option: OptionKey) {
  emit('selectAnswer', questionId, option)
}
</script>

<template>
  <section v-if="props.questions.length === 0" aria-label="Questions" style="padding: 2rem 0;">
    <p>No questions are available yet.</p>
  </section>

  <section v-else aria-label="Questions" style="display: grid; gap: 1rem;">
    <QuestionCard
      v-for="(question, index) in props.questions"
      :key="question.id"
      :question="question"
      :selected-option="props.selectedAnswers[question.id]"
      :disabled="props.disabled"
      :question-index="index"
      @select="handleSelect"
    />
  </section>
</template>
