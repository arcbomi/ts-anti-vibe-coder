import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { RepositoryPage } from '@/pages/RepositoryPage'
import { AnalysisPage } from '@/pages/AnalysisPage'
import { ExamPage } from '@/pages/ExamPage'
import { ResultPage } from '@/pages/ResultPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/repository/connect" element={<RepositoryPage mode="connect" />} />
        <Route path="/repository/status" element={<RepositoryPage mode="status" />} />

        <Route path="/analysis/:jobId" element={<AnalysisPage />} />

        <Route path="/exam/:examId" element={<ExamPage />} />
        <Route path="/exam/:examId/result" element={<ResultPage />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
