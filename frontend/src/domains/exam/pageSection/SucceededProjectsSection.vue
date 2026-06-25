<script setup lang="ts">
import { useRouter } from 'vue-router'

import AuthHeaderSection from '@/domains/auth/pageSection/AuthHeaderSection.vue'
import { SucceededProjectsSectionView } from '@/domains/exam/pageSection/SucceededProjectsSectionView'

const router = useRouter()

function navigateToExam(examId: string, projectName?: string) {
  void router.push({
    path: `/exam/${examId}`,
    query: projectName ? { projectName } : undefined,
  })
}
</script>

<template>
  <AuthHeaderSection />
  <SucceededProjectsSectionView :on-navigate-to-exam="navigateToExam" />
</template>
