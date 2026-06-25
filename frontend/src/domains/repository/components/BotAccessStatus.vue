<script setup lang="ts">
import type { BotAccessStatus as Status } from '@/domains/repository/types/repository.types'

defineProps<{
  status: Status
}>()

const statusLabels: Record<Status, string> = {
  unknown: 'Waiting for collaborator access confirmation.',
  checking: 'Checking whether the Gitea userbot can access this repository...',
  granted: 'Bot access confirmed. You can start AI analysis now.',
  denied: 'Bot access denied. Please make sure you added the correct Gitea userbot as a collaborator.',
  failed: 'Bot access denied. Please make sure you added the correct Gitea userbot as a collaborator.',
}
</script>

<template>
  <p aria-live="polite">{{ statusLabels[status] }}</p>
</template>
