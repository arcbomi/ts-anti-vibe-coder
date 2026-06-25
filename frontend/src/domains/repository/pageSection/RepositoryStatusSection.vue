<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import BotAccessStatus from '@/domains/repository/components/BotAccessStatus.vue'
import BotInstructionCard from '@/domains/repository/components/BotInstructionCard.vue'
import { useBotAccessCheck } from '@/domains/repository/hooks/useBotAccessCheck'
import { useRepositories } from '@/domains/repository/hooks/useRepositories'
import Button from '@/shared/components/Button.vue'
import Card from '@/shared/components/Card.vue'
import ErrorState from '@/shared/components/ErrorState.vue'
import LoadingState from '@/shared/components/LoadingState.vue'

const props = withDefaults(defineProps<{
  showInstructionCard?: boolean
}>(), {
  showInstructionCard: true,
})

const router = useRouter()
const {
  repositories,
  repository,
  error,
  isLoadingRepositories,
  isCheckingBotAccess,
  isStartingAnalysis,
  loadRepositories,
  selectRepository,
  startAnalysis,
} = useRepositories()
const { checkBotAccess } = useBotAccessCheck()
const botUsername = import.meta.env.VITE_GITEA_BOT_USERNAME ?? 'gitea-server-userbot'
const otherRepositories = computed(() =>
  repository.value ? repositories.value.filter((item) => item.id !== repository.value?.id) : [],
)

function questionWorkStatus(status?: string | null) {
  switch (status) {
    case 'checking_bot_access':
      return 'Checking whether the bot can access the repository.'
    case 'reading_repository':
      return 'The bot is downloading readable repository files now.'
    case 'indexing_code':
      return 'Repository files were downloaded. The backend is indexing code.'
    case 'analyzing_code':
      return 'The backend is analyzing the repository.'
    case 'generating_questions':
      return 'Question generation is running.'
    case 'saving_questions':
      return 'Questions are being saved.'
    case 'completed':
      return 'Questions are ready.'
    case 'failed':
      return 'Question work failed.'
    default:
      return 'Question work has not started yet.'
  }
}

onMounted(() => {
  if (!repository.value && repositories.value.length === 0) {
    void loadRepositories()
  }
})

async function handleStartAnalysis() {
  const analysisJobId = await startAnalysis()
  if (analysisJobId) {
    void router.push(`/analysis/${analysisJobId}`)
  }
}
</script>

<template>
  <Card v-if="!repository">
    <section class="section-stack">
      <h1>Repository access status</h1>
      <p class="section-lede">Choose the repository you want to test before checking bot access.</p>
      <LoadingState v-if="isLoadingRepositories" label="Loading repositories..." />
      <div v-if="repositories.length > 0" class="repo-list">
        <div v-for="item in repositories" :key="item.id" class="repo-card">
          <div class="section-stack--tight">
            <strong>{{ item.gitea_project_path ?? item.gitea_repo_url }}</strong>
            <p><code>{{ item.gitea_repo_url }}</code></p>
            <p v-if="item.tomorrow_audit_text">Audits: {{ item.tomorrow_audit_text }}</p>
            <p>Question work: {{ questionWorkStatus(item.latestAnalysisStatus) }}</p>
          </div>
          <Button type="button" @click="selectRepository(item)">Choose this repo</Button>
        </div>
      </div>
      <p v-else>
        <RouterLink to="/repository/connect">Refresh from Tomorrow</RouterLink>
      </p>
    </section>
  </Card>

  <section v-else class="section-stack">
    <p class="eyebrow">Step 2</p>
    <h1>Repository access status</h1>
    <p class="section-lede">
      The student adds the bot collaborator manually. After that, the backend checks access, downloads the
      repository through the bot account, and updates question work status.
    </p>
    <BotInstructionCard v-if="props.showInstructionCard" :bot-username="botUsername" />
    <Card>
      <section class="section-stack">
        <p class="section-lede">
          Repository:
          <code>{{ repository.gitea_repo_url }}</code>
        </p>
        <p v-if="repository.tomorrow_audit_text">Audits: {{ repository.tomorrow_audit_text }}</p>
        <BotAccessStatus :status="repository.bot_access_status" />
        <p>Question work status: {{ questionWorkStatus(repository.latestAnalysisStatus) }}</p>
        <p v-if="repository.latestAnalysisStatus === 'failed' && repository.latestAnalysisErrorMessage">
          {{ repository.latestAnalysisErrorMessage }}
        </p>
        <ErrorState v-if="error" :message="error" />
        <LoadingState v-if="isCheckingBotAccess" label="Checking bot access..." />
        <div class="button-row">
          <Button type="button" :disabled="isCheckingBotAccess" @click="checkBotAccess">
            I already added the bot
          </Button>
          <Button
            type="button"
            :disabled="repository.bot_access_status !== 'granted' || isStartingAnalysis"
            @click="handleStartAnalysis"
          >
            {{ isStartingAnalysis ? 'Starting question work...' : 'Start question work' }}
          </Button>
        </div>
      </section>
    </Card>
    <Card v-if="repositories.length > 1">
      <section class="section-stack">
        <h2>Choose another repository</h2>
        <div class="repo-list">
          <div v-for="item in otherRepositories" :key="item.id" class="repo-card repo-card--compact">
            <div class="section-stack--tight">
              <strong>{{ item.gitea_project_path ?? item.gitea_repo_url }}</strong>
              <p v-if="item.tomorrow_audit_text">Audits: {{ item.tomorrow_audit_text }}</p>
              <p>Question work: {{ questionWorkStatus(item.latestAnalysisStatus) }}</p>
            </div>
            <Button type="button" @click="selectRepository(item)">Switch</Button>
          </div>
        </div>
      </section>
    </Card>
    <Card v-if="repository.latestAnalysisJobId">
      <section class="section-stack">
        <h2>Latest question work</h2>
        <p class="section-lede">A previous question-work job already exists for this repository.</p>
        <Button type="button" @click="router.push(`/analysis/${repository.latestAnalysisJobId}`)">
          Open question work
        </Button>
      </section>
    </Card>
  </section>
</template>
