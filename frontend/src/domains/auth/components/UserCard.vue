<script setup lang="ts">
import { computed } from 'vue'

import type { AuthUser } from '@/domains/auth/types/auth.types'
import Button from '@/shared/components/Button.vue'

const props = withDefaults(defineProps<{
  user: AuthUser
  isLoading?: boolean
}>(), {
  isLoading: false,
})

defineEmits<{
  (event: 'logout'): void
}>()

const displayName = computed(() => props.user.full_name?.trim() || props.user.name)
</script>

<template>
  <section class="user-card" aria-label="Current user">
    <div class="user-card__identity">
      <strong>{{ displayName }}</strong>
      <span>{{ props.user.email }}</span>
    </div>
    <Button type="button" class-name="button--secondary" :disabled="props.isLoading" @click="$emit('logout')">
      {{ props.isLoading ? 'Logging out...' : 'Logout' }}
    </Button>
  </section>
</template>
