import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { succeededProjectsApi } from '@/domains/exam/api/succeededProjectsApi'
import type { SucceededProject } from '@/domains/exam/types/succeededProjects.types'
import { AuthHeaderSection } from '@/domains/auth/pageSection/AuthHeaderSection'
import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { ErrorState } from '@/shared/components/ErrorState'
import { LoadingState } from '@/shared/components/LoadingState'
import { ApiError } from '@/shared/api/client'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback
}

function preparationLabel(status: SucceededProject['preparationStatus']) {
  switch (status) {
    case 'not_started':
      return 'Not prepared'
    case 'preparing':
      return 'Preparing'
    case 'ready_to_pass':
      return 'Ready'
    case 'passed':
      return 'Passed'
    case 'failed':
      return 'Failed'
    case 'failed_generation':
      return 'Preparation failed'
    default:
      return 'Unknown'
  }
}

export function SucceededProjectsSection() {
  const [projects, setProjects] = useState<SucceededProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [startingProjectSlug, setStartingProjectSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      setError(null)
      setProjects(await succeededProjectsApi.listSucceededProjects())
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Failed to load succeeded projects.'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timeoutID = window.setTimeout(() => void loadProjects(true), 0)
    return () => window.clearTimeout(timeoutID)
  }, [loadProjects])

  useEffect(() => {
    const hasPreparingProject = projects.some((project) => project.preparationStatus === 'preparing')
    if (!hasPreparingProject) return undefined

    let isActive = true
    let timeoutID: number | undefined

    const poll = async () => {
      await loadProjects(false)
      if (isActive) {
        timeoutID = window.setTimeout(() => void poll(), 5000)
      }
    }

    timeoutID = window.setTimeout(() => void poll(), 5000)

    return () => {
      isActive = false
      if (timeoutID !== undefined) window.clearTimeout(timeoutID)
    }
  }, [loadProjects, projects])

  async function handleTryPass(projectSlug: string) {
    setStartingProjectSlug(projectSlug)
    try {
      setError(null)
      const response = await succeededProjectsApi.startSucceededProjectPreparation(projectSlug)
      setProjects((currentProjects) => currentProjects.map((project) => (
        project.projectSlug === response.projectSlug
          ? { ...project, preparationStatus: response.preparationStatus, preparationErrorMessage: undefined }
          : project
      )))
    } catch (startError) {
      setError(getErrorMessage(startError, 'Failed to start preparation.'))
    } finally {
      setStartingProjectSlug(null)
    }
  }

  if (isLoading) {
    return (
      <>
        <AuthHeaderSection />
        <LoadingState label="Loading succeeded projects..." />
      </>
    )
  }

  return (
    <>
      <AuthHeaderSection />

      <Card>
        <section className="section-stack">
          <div className="status-bar">
            <div>
              <p className="eyebrow">Tomorrow Projects</p>
              <h1>Succeeded projects</h1>
            </div>
            <Button className="button--secondary" disabled={isRefreshing} onClick={() => void loadProjects(false)}>
              {isRefreshing ? 'Syncing...' : 'Refresh projects'}
            </Button>
          </div>
          <p className="section-lede">
            Review the Tomorrow projects you already succeeded, then start preparation when you are ready to prove your
            code understanding.
          </p>
        </section>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {projects.length === 0 ? (
        <Card>
          <div className="callout callout--neutral">
            No succeeded Tomorrow projects are available for this account yet.
          </div>
        </Card>
      ) : null}

      <div className="question-stack">
        {projects.map((project) => {
          const isStarting = startingProjectSlug === project.projectSlug

          return (
            <Card key={project.projectSlug}>
              <section className="section-stack">
                <div className="status-bar">
                  <div className="section-stack--tight">
                    <h2>{project.projectName}</h2>
                    <p className="section-lede">Tomorrow status: {project.projectStatus}</p>
                  </div>
                  <span className="eyebrow">{preparationLabel(project.preparationStatus)}</span>
                </div>

                <div className="section-stack--tight">
                  <p>
                    Repo:{' '}
                    <a href={project.repoUrl} target="_blank" rel="noreferrer">
                      {project.repoUrl}
                    </a>
                  </p>
                  <p>Exam preparation: {preparationLabel(project.preparationStatus)}</p>
                  {project.auditText ? <p>Audit info: {project.auditText}</p> : null}
                  {project.preparationStatus === 'failed_generation' && project.preparationErrorMessage ? (
                    <p className="status-danger">{project.preparationErrorMessage}</p>
                  ) : null}
                </div>

                <div className="button-row">
                  {project.preparationStatus === 'not_started' ? (
                    <Button disabled={isStarting} onClick={() => void handleTryPass(project.projectSlug)}>
                      {isStarting ? 'Starting...' : 'Try Pass'}
                    </Button>
                  ) : null}

                  {project.preparationStatus === 'preparing' ? (
                    <Button disabled>Preparing</Button>
                  ) : null}

                  {project.preparationStatus === 'ready_to_pass' ? (
                    project.examId ? (
                      <Link className="button" to={`/exam/${project.examId}`} state={{ projectName: project.projectName }}>
                        Start Exam
                      </Link>
                    ) : (
                      <Button disabled>Start Exam</Button>
                    )
                  ) : null}

                  {project.preparationStatus === 'passed' ? <Button disabled>Already passed</Button> : null}

                  {project.preparationStatus === 'failed' ? <p className="status-danger">Failed</p> : null}

                  {project.preparationStatus === 'failed_generation' ? (
                    <Button disabled={isStarting} onClick={() => void handleTryPass(project.projectSlug)}>
                      {isStarting ? 'Retrying...' : 'Retry preparation'}
                    </Button>
                  ) : null}
                </div>
              </section>
            </Card>
          )
        })}
      </div>
    </>
  )
}
