<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { authStore } from '@/domains/auth/store/authStore'

const router = useRouter()

onMounted(() => {
  router.replace(authStore.getState().token ? '/dashboard' : '/login')
})
</script>

<template>
  <main class="page-shell">
    <p class="section-lede">Redirecting...</p>
  </main>
</template>
