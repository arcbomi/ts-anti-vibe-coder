<script setup lang="ts">
import type { ExamQuestion, OptionKey } from '@/domains/question/types/question.types'

import OptionButton from '@/domains/question/components/OptionButton.vue'
import Card from '@/shared/components/Card.vue'

const optionKeys: OptionKey[] = ['A', 'B', 'C', 'D']

const props = withDefaults(defineProps<{
  question: ExamQuestion
  selectedOption?: OptionKey
  disabled?: boolean
  questionIndex?: number
}>(), {
  selectedOption: undefined,
  disabled: false,
  questionIndex: undefined,
})

defineEmits<{
  (event: 'select', questionId: string, option: OptionKey): void
}>()
</script>

<template>
  <Card>
    <article
      :aria-labelledby="`question-${props.question.id}`"
      style="padding: 1.25rem; border: 1px solid var(--border); border-radius: 16px; text-align: left;"
    >
      <p
        v-if="props.questionIndex !== undefined"
        style="margin-bottom: 0.5rem; color: var(--accent); font-weight: 700;"
      >
        Question {{ props.questionIndex + 1 }}
      </p>

      <h2 :id="`question-${props.question.id}`" style="margin-bottom: 1rem;">
        {{ props.question.question }}
      </h2>

      <p v-if="props.question.sourceFilePath" style="margin-bottom: 1rem;">
        <code>{{ props.question.sourceFilePath }}</code>
      </p>

      <div style="display: grid; gap: 0.75rem;">
        <OptionButton
          v-for="optionKey in optionKeys"
          :key="optionKey"
          :option-key="optionKey"
          :text="props.question.options[optionKey]"
          :selected="props.selectedOption === optionKey"
          :disabled="props.disabled"
          @select="$emit('select', props.question.id, $event)"
        />
      </div>
    </article>
  </Card>
</template>
