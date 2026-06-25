<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AnalysisProgress from '@/domains/analysis/components/AnalysisProgress.vue'
import { useAnalysisJob } from '@/domains/analysis/hooks/useAnalysisJob'
import ErrorState from '@/shared/components/ErrorState.vue'
import LoadingState from '@/shared/components/LoadingState.vue'

const props = defineProps<{
  jobId?: string
}>()

const route = useRoute()
const jobId = computed(() => props.jobId ?? (route.params.jobId as string | undefined))
const { job, isLoading, error } = useAnalysisJob(jobId)
</script>

<template>
  <ErrorState v-if="error && !job" :message="error" />
  <LoadingState v-else-if="isLoading && !job" label="Loading analysis job..." />
  <LoadingState v-else-if="!job" label="Waiting for analysis job..." />
  <section v-else class="section-stack">
    <h1>AI Analysis Progress</h1>
    <p class="section-lede">
      The backend is checking repository access, reading code, and generating the question set.
    </p>
    <ErrorState v-if="error" :message="error" />
    <AnalysisProgress :job="job" />
    <div v-if="job.status === 'completed'" class="callout callout--success">
      <h2>Analysis completed.</h2>
      <p>20 English-only exam questions are ready.</p>
      <p>You can now wait for the Friday offline exam.</p>
    </div>
  </section>
</template>
