<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import BotInstructionCard from '@/domains/repository/components/BotInstructionCard.vue'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import RepositoryStatusSection from '@/domains/repository/pageSection/RepositoryStatusSection.vue'
import type { Repository } from '@/domains/repository/types/repository.types'
import Button from '@/shared/components/Button.vue'
import Card from '@/shared/components/Card.vue'
import ErrorState from '@/shared/components/ErrorState.vue'
import LoadingState from '@/shared/components/LoadingState.vue'

const router = useRouter()
const {
  repositories,
  repository,
  isLoadingRepositories,
  isSyncingTomorrow,
  error,
  syncMessage,
  loadRepositories,
  syncTomorrowProjects,
  selectRepository,
} = useRepositories()
const botUsername = import.meta.env.VITE_GITEA_BOT_USERNAME ?? 'gitea-server-userbot'

function questionWorkLabel(item: Repository) {
  switch (item.latestAnalysisStatus) {
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
      return item.latestAnalysisErrorMessage ?? 'Question work failed'
    default:
      return 'Not started'
  }
}

onMounted(() => {
  void loadRepositories()
})

function chooseRepository(item: Repository) {
  selectRepository(item)
  void router.push('/repository/status')
}
</script>

<template>
  <section class="section-stack">
    <p class="eyebrow">Step 1</p>
    <h1>Choose the repository to test</h1>
    <p class="section-lede">
      Refresh from Tomorrow to pull the current connected user's succeeded projects. After that, the student adds
      the bot collaborator and the backend tracks question work status.
    </p>

    <Card>
      <section class="section-stack">
        <h2>Your repository list</h2>
        <p class="section-lede">
          Only projects marked <strong>Project succeeded</strong> are kept here. Refresh any time to resync from your
          Tomorrow profile.
        </p>
        <div class="button-row">
          <Button type="button" :disabled="isSyncingTomorrow" @click="syncTomorrowProjects">
            {{ isSyncingTomorrow ? 'Syncing Tomorrow projects...' : 'Refresh from Tomorrow' }}
          </Button>
        </div>
        <LoadingState v-if="isLoadingRepositories" label="Loading repositories..." />
        <LoadingState v-if="isSyncingTomorrow" label="Syncing Tomorrow projects..." />
        <div v-if="syncMessage" class="callout callout--success">{{ syncMessage }}</div>
        <div v-if="repositories.length > 0" class="repo-list">
          <div
            v-for="item in repositories"
            :key="item.id"
            :class="repository?.id === item.id ? 'repo-card repo-card--selected' : 'repo-card'"
          >
            <div class="section-stack--tight">
              <strong>{{ item.gitea_project_path ?? item.gitea_repo_url }}</strong>
              <p><code>{{ item.gitea_repo_url }}</code></p>
              <p v-if="item.tomorrow_audit_text">
                Audits:
                <strong>{{ item.tomorrow_audit_text }}</strong>
              </p>
              <p>
                Bot access:
                <strong>{{ item.bot_access_status }}</strong>
              </p>
              <p>
                Question work:
                <strong>{{ questionWorkLabel(item) }}</strong>
              </p>
            </div>
            <div class="button-row">
              <Button type="button" @click="chooseRepository(item)">
                {{ repository?.id === item.id ? 'Continue with this repo' : 'Choose this repo' }}
              </Button>
              <Button
                v-if="item.latestAnalysisJobId"
                type="button"
                class-name="button--secondary"
                @click="router.push(`/analysis/${item.latestAnalysisJobId}`)"
              >
                Open question work
              </Button>
            </div>
          </div>
        </div>
        <div v-else class="callout callout--neutral">
          No succeeded Tomorrow projects found yet. Try <strong>Refresh from Tomorrow</strong>.
        </div>
      </section>
    </Card>

    <ErrorState v-if="error" :message="error" />
    <BotInstructionCard :bot-username="botUsername" />
    <div v-if="repository" class="callout callout--success">
      Repository selected. Continue below or open the
      <RouterLink to="/repository/status">repository status page</RouterLink>.
    </div>
    <RepositoryStatusSection v-if="repository" :show-instruction-card="false" />
  </section>
</template>
