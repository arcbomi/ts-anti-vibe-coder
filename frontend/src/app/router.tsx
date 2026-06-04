import { createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute } from '@/app/ProtectedRoute'
import { AnalysisPage } from '@/pages/AnalysisPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ExamPage } from '@/pages/ExamPage'
import { ExamResultPage } from '@/pages/ExamResultPage'
import { HomeRedirectPage } from '@/pages/HomeRedirectPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RepositoryConnectPage } from '@/pages/RepositoryConnectPage'
import { RepositoryStatusPage } from '@/pages/RepositoryStatusPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeRedirectPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/repository/connect',
    element: (
      <ProtectedRoute>
        <RepositoryConnectPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/repository/status',
    element: (
      <ProtectedRoute>
        <RepositoryStatusPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/analysis/:jobId',
    element: (
      <ProtectedRoute>
        <AnalysisPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/exam/:examId',
    element: (
      <ProtectedRoute>
        <ExamPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/exam/:examId/result',
    element: (
      <ProtectedRoute>
        <ExamResultPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
