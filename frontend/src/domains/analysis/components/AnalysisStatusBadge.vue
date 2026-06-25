<script setup lang="ts">
import type { AnalysisJobStatus } from '@/domains/analysis/types/analysis.types'

defineProps<{
  status: AnalysisJobStatus
}>()

const statusLabels: Record<AnalysisJobStatus, string> = {
  pending: 'Pending',
  checking_bot_access: 'Checking bot access',
  reading_repository: 'Reading repository',
  indexing_code: 'Indexing code',
  analyzing_code: 'Analyzing code',
  generating_questions: 'Generating questions',
  saving_questions: 'Saving questions',
  completed: 'Completed',
  failed: 'Failed',
}
</script>

<template>
  <span :aria-label="`Analysis status: ${statusLabels[status]}`">
    {{ statusLabels[status] }}
    <span class="sr-only">{{ status }}</span>
  </span>
</template>
