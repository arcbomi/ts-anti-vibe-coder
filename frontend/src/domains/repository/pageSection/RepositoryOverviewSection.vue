<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import Card from '@/shared/components/Card.vue'

const { repositories, repository } = useRepositories()

function questionWorkLabel(status?: string | null) {
  switch (status) {
    case 'pending':
      return 'Queued'
    case 'checking_bot_access':
      return 'Checking bot access'
    case 'reading_repository':
      return 'Downloading repository'
    case 'indexing_code':
      return 'Indexing code'
    case 'analyzing_code':
      return 'Analyzing code'
    case 'generating_questions':
      return 'Generating questions'
    case 'saving_questions':
      return 'Saving questions'
    case 'completed':
      return 'Questions ready'
    case 'failed':
      return 'Question work failed'
    default:
      return 'Not started'
  }
}
</script>

<template>
  <Card>
    <section class="section-stack">
      <h2>Your repositories</h2>
      <template v-if="repositories.length > 0">
        <p class="section-lede">
          Pick the repository you want to verify. The bot only reads code after you add it as a collaborator.
        </p>
        <div class="section-stack--tight">
          <div v-for="item in repositories.slice(0, 3)" :key="item.id" class="repo-summary-row">
            <div>
              <strong>{{ item.gitea_project_path ?? item.gitea_repo_url }}</strong>
              <p v-if="item.tomorrow_audit_text">Audits: {{ item.tomorrow_audit_text }}</p>
              <p>Question work: {{ questionWorkLabel(item.latestAnalysisStatus) }}</p>
            </div>
            <RouterLink :to="repository?.id === item.id ? '/repository/status' : '/repository/connect'">
              {{ repository?.id === item.id ? 'Open status' : 'Choose repo' }}
            </RouterLink>
          </div>
        </div>
      </template>
      <template v-else>
        <p class="section-lede">Refresh your succeeded Tomorrow projects before choosing a repository to test.</p>
        <p>
          <RouterLink to="/repository/connect">Refresh from Tomorrow</RouterLink>
        </p>
      </template>
    </section>
  </Card>
</template>
