export type SucceededProjectPreparationStatus =
  | 'not_started'
  | 'preparing'
  | 'ready_to_pass'
  | 'passed'
  | 'failed'
  | 'failed_generation'

export interface SucceededProject {
  projectSlug: string
  projectName: string
  projectStatus: string
  repoUrl: string
  auditText?: string
  preparationStatus: SucceededProjectPreparationStatus
  preparationErrorMessage?: string
  examId?: string
}

export type RawSucceededProject = {
  project_slug: string
  project_name: string
  project_status: string
  repo_url: string
  audit_text?: string
  preparation_status: SucceededProjectPreparationStatus
  preparation_error_message?: string
  exam_id?: string
}

export type RawSucceededProjectsResponse = {
  projects: RawSucceededProject[]
}

export type RawStartSucceededProjectPreparationResponse = {
  project_slug: string
  preparation_status: SucceededProjectPreparationStatus
  attempt_id: string
}

export type StartSucceededProjectPreparationResponse = {
  projectSlug: string
  preparationStatus: SucceededProjectPreparationStatus
  attemptId: string
}
