import { computed, defineComponent, h, watch } from 'vue'

import { useExam } from '@/domains/exam/hooks/useExam'

function formatProjectName(projectSlug?: string) {
  if (!projectSlug) return 'Selected project'

  return (
    projectSlug
      .split('/')
      .at(-1)
      ?.split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Selected project'
  )
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

export const ExamResultSectionView = defineComponent({
  name: 'ExamResultSectionView',
  props: {
    examId: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    const examId = computed(() => props.examId)
    const { exam, result, isLoading, error, loadResult } = useExam(examId)

    watch(
      examId,
      (nextExamId) => {
        if (nextExamId) {
          void loadResult()
        }
      },
      { immediate: true },
    )

    const projectName = computed(
      () => exam.value?.projectName ?? formatProjectName(result.value?.projectSlug || exam.value?.projectSlug),
    )

    return () => {
      if (!examId.value) return renderCallout('Missing exam id.')
      if (isLoading.value && !result.value) return renderCallout('Loading exam result...', 'neutral')
      if (error.value && !result.value) return renderCallout(error.value)
      if (!result.value) return renderCallout('Preparing exam result...', 'neutral')

      return h('section', { class: 'page-shell section-stack' }, [
        h('header', { class: 'section-stack' }, [
          h(
            'p',
            {
              class: result.value.passed ? 'eyebrow eyebrow--success' : 'eyebrow eyebrow--danger',
            },
            result.value.passed
              ? 'Passed - you demonstrated understanding of this repository.'
              : 'Failed - review the repository and try again later.',
          ),
          h('h1', 'Exam result'),
          h('p', { class: 'section-lede' }, projectName.value),
        ]),
        error.value ? renderCallout(error.value) : null,
        h('div', { class: 'card' }, [
          h('div', { class: 'metric-grid' }, [
            h('div', { class: 'metric' }, [
              h('span', { class: 'metric__label' }, 'Score'),
              h('div', { class: 'metric__value metric__value--large' }, String(result.value.score)),
            ]),
            h('div', { class: 'metric' }, [
              h('span', { class: 'metric__label' }, 'Correct answers'),
              h('div', { class: 'metric__value' }, `${result.value.correctCount} / ${result.value.totalQuestions}`),
            ]),
            h('div', { class: 'metric' }, [
              h('span', { class: 'metric__label' }, 'Passing score'),
              h('div', { class: 'metric__value' }, String(result.value.passingScore)),
            ]),
            h('div', { class: 'metric' }, [
              h('span', { class: 'metric__label' }, 'Status'),
              h('div', { class: 'metric__value metric__value--caps' }, result.value.status),
            ]),
          ]),
        ]),
      ])
    }
  },
})
