<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/shared/components/Button.vue'

const props = withDefaults(defineProps<{
  isLoading?: boolean
}>(), {
  isLoading: false,
})

const emit = defineEmits<{
  (event: 'submit', url: string): void
}>()

const url = ref('')
const trimmedUrl = computed(() => url.value.trim())

function handleSubmit() {
  if (!trimmedUrl.value || props.isLoading) return
  emit('submit', trimmedUrl.value)
}
</script>

<template>
  <form class="section-stack" @submit.prevent="handleSubmit">
    <label class="field">
      <span>Gitea repository URL</span>
      <input
        v-model="url"
        type="url"
        placeholder="https://gitea.com/group/project"
        :disabled="props.isLoading"
        required
      >
    </label>
    <p class="field-hint">You do not need to upload code or share a personal token.</p>
    <Button type="submit" :disabled="props.isLoading || !trimmedUrl">
      {{ props.isLoading ? 'Connecting...' : 'Connect repository' }}
    </Button>
  </form>
</template>
