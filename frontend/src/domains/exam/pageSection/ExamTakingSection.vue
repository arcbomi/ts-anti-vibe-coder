<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ExamTakingSectionView } from '@/domains/exam/pageSection/ExamTakingSectionView'

const props = defineProps<{
  examId?: string
}>()

const route = useRoute()
const router = useRouter()

const examId = computed(() => props.examId ?? (route.params.examId as string | undefined))
const locationProjectName = computed(() =>
  typeof route.query.projectName === 'string' ? route.query.projectName : undefined,
)

function navigateToResult(targetExamId: string) {
  void router.replace(`/exam/${targetExamId}/result`)
}
</script>

<template>
  <ExamTakingSectionView
    :exam-id="examId"
    :location-project-name="locationProjectName"
    :on-navigate-to-result="navigateToResult"
  />
</template>
