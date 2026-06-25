<script setup lang="ts">
import { watchEffect } from 'vue'

import UserCard from '@/domains/auth/components/UserCard.vue'
import { useAuth } from '@/domains/auth/hooks/useAuth'
import Card from '@/shared/components/Card.vue'
import ErrorState from '@/shared/components/ErrorState.vue'
import LoadingState from '@/shared/components/LoadingState.vue'

const { error, isLoading, loadCurrentUser, logout, token, user } = useAuth()

watchEffect(() => {
  if (token.value && !user.value && !isLoading.value) {
    void loadCurrentUser()
  }
})
</script>

<template>
  <Card>
    <header class="section-stack">
      <h1>Account</h1>
      <p class="section-lede">
        Your session stays in sync with the backend so route changes keep working after refresh.
      </p>
      <LoadingState v-if="isLoading && !user" label="Loading current user..." />
      <ErrorState v-if="error" :message="error" />
      <UserCard v-if="user" :user="user" :is-loading="isLoading" @logout="logout" />
      <div v-else>Not logged in</div>
    </header>
  </Card>
</template>
