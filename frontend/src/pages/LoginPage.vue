<template>
  <main class="page-shell">
    <LoginSection @login-success="handleLoginSuccess" />
  </main>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import LoginSection from '@/domains/auth/pageSection/LoginSection.vue'

const route = useRoute()
const router = useRouter()

function handleLoginSuccess() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
  void router.push(redirect)
}
</script>
