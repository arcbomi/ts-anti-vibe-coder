<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { ExamResultSectionView } from '@/domains/exam/pageSection/ExamResultSectionView'

const props = defineProps<{
  examId?: string
}>()

const route = useRoute()
const examId = computed(() => props.examId ?? (route.params.examId as string | undefined))
</script>

<template>
  <ExamResultSectionView :exam-id="examId" />
</template>
