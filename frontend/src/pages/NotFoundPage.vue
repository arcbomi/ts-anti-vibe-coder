<template>
  <main class="page-shell">
    <Card>
      <section class="section-stack" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Page not found</h1>
        <p class="section-lede">The route you opened does not exist in this app.</p>
        <p>
          <RouterLink to="/">Go back to the app home</RouterLink>
        </p>
      </section>
    </Card>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

import Card from '@/shared/components/Card.vue'
</script>
