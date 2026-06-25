<template>
  <Card>
    <section class="section-stack" aria-labelledby="login-title">
      <h1 id="login-title">Log in to start your codebase understanding exam.</h1>
      <p class="section-lede">
        This platform verifies real codebase understanding before students begin their exam.
      </p>
      <LoginForm @success="$emit('loginSuccess')" />
    </section>
  </Card>
</template>

<script setup lang="ts">
import LoginForm from '@/domains/auth/components/LoginForm.vue'
import Card from '@/shared/components/Card.vue'

defineEmits<{
  (event: 'loginSuccess'): void
}>()
</script>
