import { createRouter, createWebHistory } from 'vue-router'

import { authApi } from '@/domains/auth/api/authApi'
import { authStore } from '@/domains/auth/store/authStore'
import AnalysisPage from '@/pages/AnalysisPage.vue'
import DashboardPage from '@/pages/DashboardPage.vue'
import ExamPage from '@/pages/ExamPage.vue'
import ExamResultPage from '@/pages/ExamResultPage.vue'
import HomeRedirectPage from '@/pages/HomeRedirectPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import RepositoryConnectPage from '@/pages/RepositoryConnectPage.vue'
import RepositoryStatusPage from '@/pages/RepositoryStatusPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeRedirectPage },
    { path: '/login', component: LoginPage },
    { path: '/dashboard', component: DashboardPage, meta: { requiresAuth: true } },
    { path: '/repository/connect', component: RepositoryConnectPage, meta: { requiresAuth: true } },
    { path: '/repository/status', component: RepositoryStatusPage, meta: { requiresAuth: true } },
    { path: '/analysis/:jobId', component: AnalysisPage, meta: { requiresAuth: true } },
    { path: '/exam/:examId', component: ExamPage, meta: { requiresAuth: true } },
    { path: '/exam/:examId/result', component: ExamResultPage, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', component: NotFoundPage },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  const state = authStore.getState()
  if (!state.token) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
      replace: true,
    }
  }

  if (!state.user && !state.isLoading) {
    state.setLoading(true)
    state.setError(null)

    try {
      const user = await authApi.getCurrentUser()
      authStore.getState().setUser(user)
    } catch (error) {
      authStore.getState().setError(error instanceof Error ? error.message : 'Session expired.')
      authStore.getState().clearAuth()
      return {
        path: '/login',
        query: { redirect: to.fullPath },
        replace: true,
      }
    } finally {
      authStore.getState().setLoading(false)
    }
  }

  return true
})
