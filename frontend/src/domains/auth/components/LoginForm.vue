<script setup lang="ts">
import { ref } from 'vue'

import { useAuth } from '@/domains/auth/hooks/useAuth'
import Button from '@/shared/components/Button.vue'
import ErrorState from '@/shared/components/ErrorState.vue'
import LoadingState from '@/shared/components/LoadingState.vue'

const emit = defineEmits<{
  (event: 'success'): void
}>()

const { error, isLoading, login } = useAuth()
const credential = ref('')
const password = ref('')

async function handleSubmit() {
  await login({ credential: credential.value, password: password.value })
  emit('success')
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div class="field">
      <label for="auth-credential">Email or username</label>
      <input
        id="auth-credential"
        v-model="credential"
        name="credential"
        type="text"
        autocomplete="username"
        placeholder="student@example.com or student-user"
        required
      >
    </div>

    <div class="field">
      <label for="auth-password">Password</label>
      <input
        id="auth-password"
        v-model="password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
      >
    </div>

    <ErrorState v-if="error" :message="error" />
    <LoadingState v-if="isLoading" label="Signing in..." />

    <Button type="submit" :disabled="isLoading">
      {{ isLoading ? 'Logging in...' : 'Log in' }}
    </Button>
  </form>
</template>
