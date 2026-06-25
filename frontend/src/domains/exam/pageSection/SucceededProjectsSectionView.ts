import { defineComponent, h, onMounted, onUnmounted, ref } from 'vue'

import { succeededProjectsApi } from '@/domains/exam/api/succeededProjectsApi'
import type { SucceededProject } from '@/domains/exam/types/succeededProjects.types'
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

function renderCallout(message: string, variant: 'danger' | 'neutral' = 'danger') {
  return h(
    'div',
    {
      class: `callout callout--${variant}`,
      role: variant === 'danger' ? 'alert' : undefined,
      'aria-live': variant === 'neutral' ? 'polite' : undefined,
      'aria-busy': variant === 'neutral' ? 'true' : undefined,
    },
    message,
  )
}

export const SucceededProjectsSectionView = defineComponent({
  name: 'SucceededProjectsSectionView',
  props: {
    onNavigateToExam: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    const projects = ref<SucceededProject[]>([])
    const isLoading = ref(true)
    const isRefreshing = ref(false)
    const startingProjectSlug = ref<string | null>(null)
    const error = ref<string | null>(null)
    let initialLoadTimeoutId: number | undefined
    let pollTimeoutId: number | undefined

    const loadProjects = async (showSpinner = false) => {
      if (showSpinner) {
        isLoading.value = true
      } else {
        isRefreshing.value = true
      }

      try {
        error.value = null
        projects.value = await succeededProjectsApi.listSucceededProjects()
      } catch (loadError) {
        error.value = getErrorMessage(loadError, 'Failed to load succeeded projects.')
      } finally {
        isLoading.value = false
        isRefreshing.value = false
      }
    }

    async function schedulePoll() {
      if (pollTimeoutId !== undefined) {
        window.clearTimeout(pollTimeoutId)
      }

      if (!projects.value.some((project) => project.preparationStatus === 'preparing')) {
        return
      }

      pollTimeoutId = window.setTimeout(async () => {
        await loadProjects(false)
        void schedulePoll()
      }, 5000)
    }

    async function handleTryPass(projectSlug: string) {
      startingProjectSlug.value = projectSlug
      try {
        error.value = null
        const response = await succeededProjectsApi.startSucceededProjectPreparation(projectSlug)
        projects.value = projects.value.map((project) =>
          project.projectSlug === response.projectSlug
            ? { ...project, preparationStatus: response.preparationStatus, preparationErrorMessage: undefined }
            : project,
        )
        void schedulePoll()
      } catch (startError) {
        error.value = getErrorMessage(startError, 'Failed to start preparation.')
      } finally {
        startingProjectSlug.value = null
      }
    }

    onMounted(() => {
      initialLoadTimeoutId = window.setTimeout(() => {
        void loadProjects(true).then(() => {
          void schedulePoll()
        })
      }, 0)
    })

    onUnmounted(() => {
      if (initialLoadTimeoutId !== undefined) {
        window.clearTimeout(initialLoadTimeoutId)
      }
      if (pollTimeoutId !== undefined) {
        window.clearTimeout(pollTimeoutId)
      }
    })

    return () => {
      if (isLoading.value) {
        return renderCallout('Loading succeeded projects...', 'neutral')
      }

      return h('section', { class: 'page-shell section-stack' }, [
        h('div', { class: 'card' }, [
          h('section', { class: 'section-stack' }, [
            h('div', { class: 'status-bar' }, [
              h('div', [h('p', { class: 'eyebrow' }, 'Tomorrow Projects'), h('h1', 'Succeeded projects')]),
              h(
                'button',
                {
                  class: 'button button--secondary',
                  disabled: isRefreshing.value,
                  onClick: () => {
                    void loadProjects(false).then(() => {
                      void schedulePoll()
                    })
                  },
                },
                isRefreshing.value ? 'Syncing...' : 'Refresh projects',
              ),
            ]),
            h(
              'p',
              { class: 'section-lede' },
              'Review the Tomorrow projects you already succeeded, then start preparation when you are ready to prove your code understanding.',
            ),
          ]),
        ]),
        error.value ? renderCallout(error.value) : null,
        projects.value.length === 0
          ? h('div', { class: 'card' }, [h('div', { class: 'callout callout--neutral' }, 'No succeeded Tomorrow projects are available for this account yet.')])
          : null,
        h(
          'div',
          { class: 'question-stack' },
          projects.value.map((project) => {
            const isStarting = startingProjectSlug.value === project.projectSlug

            const actions = []

            if (project.preparationStatus === 'not_started') {
              actions.push(
                h(
                  'button',
                  {
                    class: 'button',
                    disabled: isStarting,
                    onClick: () => {
                      void handleTryPass(project.projectSlug)
                    },
                  },
                  isStarting ? 'Starting...' : 'Try Pass',
                ),
              )
            }

            if (project.preparationStatus === 'preparing') {
              actions.push(h('button', { class: 'button', disabled: true }, 'Preparing'))
            }

            if (project.preparationStatus === 'ready_to_pass') {
              actions.push(
                project.examId
                  ? h(
                      'button',
                      {
                        class: 'button',
                        onClick: () => props.onNavigateToExam(project.examId as string, project.projectName),
                      },
                      'Start Exam',
                    )
                  : h('button', { class: 'button', disabled: true }, 'Start Exam'),
              )
            }

            if (project.preparationStatus === 'passed') {
              actions.push(h('button', { class: 'button', disabled: true }, 'Already passed'))
            }

            if (project.preparationStatus === 'failed') {
              actions.push(h('p', { class: 'status-danger' }, 'Failed'))
            }

            if (project.preparationStatus === 'failed_generation') {
              actions.push(
                h(
                  'button',
                  {
                    class: 'button',
                    disabled: isStarting,
                    onClick: () => {
                      void handleTryPass(project.projectSlug)
                    },
                  },
                  isStarting ? 'Retrying...' : 'Retry preparation',
                ),
              )
            }

            return h('div', { key: project.projectSlug, class: 'card' }, [
              h('section', { class: 'section-stack' }, [
                h('div', { class: 'status-bar' }, [
                  h('div', { class: 'section-stack section-stack--tight' }, [
                    h('h2', project.projectName),
                    h('p', { class: 'section-lede' }, `Tomorrow status: ${project.projectStatus}`),
                  ]),
                  h('span', { class: 'eyebrow' }, preparationLabel(project.preparationStatus)),
                ]),
                h('div', { class: 'section-stack section-stack--tight' }, [
                  h('p', [
                    'Repo: ',
                    h(
                      'a',
                      {
                        href: project.repoUrl,
                        target: '_blank',
                        rel: 'noreferrer',
                      },
                      project.repoUrl,
                    ),
                  ]),
                  h('p', `Exam preparation: ${preparationLabel(project.preparationStatus)}`),
                  project.auditText ? h('p', `Audit info: ${project.auditText}`) : null,
                  project.preparationStatus === 'failed_generation' && project.preparationErrorMessage
                    ? h('p', { class: 'status-danger' }, project.preparationErrorMessage)
                    : null,
                ]),
                h('div', { class: 'button-row' }, actions),
              ]),
            ])
          }),
        ),
      ])
    }
  },
})
