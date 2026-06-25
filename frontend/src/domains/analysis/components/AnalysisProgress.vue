<script setup lang="ts">
import type { AnalysisJob } from '@/domains/analysis/types/analysis.types'

import AnalysisStatusBadge from '@/domains/analysis/components/AnalysisStatusBadge.vue'

const props = defineProps<{
  job: AnalysisJob
}>()

const statusMessages: Record<AnalysisJob['status'], string> = {
  pending: 'Analysis job is waiting to start.',
  checking_bot_access: 'Checking whether the Gitea userbot can access the repository.',
  reading_repository: 'Reading repository files from Gitea.',
  indexing_code: 'Indexing important source files.',
  analyzing_code: 'AI is analyzing how the program works.',
  generating_questions: 'AI is generating 20 English-only exam questions.',
  saving_questions: 'Saving generated questions.',
  completed: 'Analysis completed. Questions are ready for the exam.',
  failed: 'Analysis failed. Please check the error message.',
}

const activeStatuses: AnalysisJob['status'][] = [
  'pending',
  'checking_bot_access',
  'reading_repository',
  'indexing_code',
  'analyzing_code',
  'generating_questions',
  'saving_questions',
]
</script>

<template>
  <div aria-live="polite">
    <p>
      Status:
      <AnalysisStatusBadge :status="props.job.status" />
    </p>
    <p>{{ props.job.progressMessage ?? statusMessages[props.job.status] }}</p>
    <p v-if="props.job.status === 'analyzing_code'">
      This may include routes, handlers, services, database access, frontend pages, hooks,
      stores, and important program behavior.
    </p>
    <progress v-if="activeStatuses.includes(props.job.status)" aria-label="Analysis is in progress" />
    <p v-if="props.job.status === 'failed'" role="alert">
      {{
        props.job.errorMessage ??
        'The Gitea userbot may not have access, or the repository could not be read.'
      }}
    </p>
  </div>
</template>
