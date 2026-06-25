<script setup lang="ts">
import Card from '@/shared/components/Card.vue'

defineProps<{
  botUsername: string
}>()
</script>

<template>
  <Card>
    <div class="section-stack">
      <h2>Add the Gitea userbot</h2>
      <span class="sr-only">add the gitea-server-userbot</span>
      <p>Please add our Gitea server userbot as a collaborator to your repository.</p>
      <p>After you add it, click "I already added the bot."</p>
      <p>
        Userbot username:
        <code>{{ botUsername }}</code>
      </p>
    </div>
  </Card>
</template>
