import { createBrowserRouter } from 'react-router-dom'

import { AnalysisPage } from '@/pages/AnalysisPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ExamPage } from '@/pages/ExamPage'
import { ExamResultPage } from '@/pages/ExamResultPage'
import { LoginPage } from '@/pages/LoginPage'
import { RepositoryConnectPage } from '@/pages/RepositoryConnectPage'
import { RepositoryStatusPage } from '@/pages/RepositoryStatusPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    path: '/repository/connect',
    element: <RepositoryConnectPage />,
  },
  {
    path: '/repository/status',
    element: <RepositoryStatusPage />,
  },
  {
    path: '/analysis/:jobId',
    element: <AnalysisPage />,
  },
  {
    path: '/exam/:examId',
    element: <ExamPage />,
  },
  {
    path: '/exam/:examId/result',
    element: <ExamResultPage />,
  },
])
