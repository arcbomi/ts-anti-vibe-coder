import { apiClient } from '@/shared/api/client'
import type {
  RawSucceededProject,
  RawSucceededProjectsResponse,
  RawStartSucceededProjectPreparationResponse,
  StartSucceededProjectPreparationResponse,
  SucceededProject,
} from '@/domains/exam/types/succeededProjects.types'

function normalizeProject(project: RawSucceededProject): SucceededProject {
  return {
    projectSlug: project.project_slug,
    projectName: project.project_name,
    projectStatus: project.project_status,
    repoUrl: project.repo_url,
    auditText: project.audit_text,
    preparationStatus: project.preparation_status,
    preparationErrorMessage: project.preparation_error_message,
    examId: project.exam_id,
  }
}

export async function listSucceededProjects(): Promise<SucceededProject[]> {
  const response = await apiClient.get<RawSucceededProjectsResponse>('/succeeded-projects')
  return response.projects.map(normalizeProject)
}

export async function startSucceededProjectPreparation(
  projectSlug: string,
): Promise<StartSucceededProjectPreparationResponse> {
  const response = await apiClient.post<RawStartSucceededProjectPreparationResponse>(
    `/succeeded-projects/${projectSlug}/prepare`,
  )
  return {
    projectSlug: response.project_slug,
    preparationStatus: response.preparation_status,
    attemptId: response.attempt_id,
  }
}

export const succeededProjectsApi = {
  listSucceededProjects,
  startSucceededProjectPreparation,
}
