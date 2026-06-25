import { computed, defineComponent, h, ref, watch } from 'vue'

import ExamQuestion from '@/domains/exam/components/ExamQuestion.vue'
import SubmitExamButton from '@/domains/exam/components/SubmitExamButton.vue'
import { useExam } from '@/domains/exam/hooks/useExam'
import type { ExamOptionKey } from '@/domains/exam/types/exam.types'

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

function isSubmittedStatus(status?: string) {
  return status === 'submitted' || status === 'passed' || status === 'failed'
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

export const ExamTakingSectionView = defineComponent({
  name: 'ExamTakingSectionView',
  props: {
    examId: {
      type: String,
      default: undefined,
    },
    locationProjectName: {
      type: String,
      default: undefined,
    },
    onNavigateToResult: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    const missingAnswersError = ref<string | null>(null)
    const examId = computed(() => props.examId)
    const { exam, selectedAnswers, isLoading, isSubmitting, error, loadExam, selectAnswer, submitExam } = useExam(examId)

    watch(
      examId,
      (nextExamId) => {
        if (nextExamId) {
          void loadExam()
        }
      },
      { immediate: true },
    )

    watch(
      [examId, exam],
      ([nextExamId, nextExam]) => {
        if (nextExamId && nextExam && isSubmittedStatus(nextExam.status)) {
          props.onNavigateToResult(nextExamId)
        }
      },
      { immediate: true },
    )

    const totalCount = computed(() => exam.value?.questions.length ?? 0)
    const answeredCount = computed(() =>
      (exam.value?.questions ?? []).reduce(
        (count: number, question: NonNullable<typeof exam.value>['questions'][number]) =>
          selectedAnswers.value[question.id] ? count + 1 : count,
        0,
      ),
    )
    const missingCount = computed(() => Math.max(totalCount.value - answeredCount.value, 0))
    const allQuestionsAnswered = computed(() => totalCount.value === 20 && missingCount.value === 0)
    const projectName = computed(
      () =>
        exam.value?.projectName ||
        props.locationProjectName ||
        formatProjectName(exam.value?.projectSlug),
    )

    async function handleSubmit() {
      if (!allQuestionsAnswered.value) {
        missingAnswersError.value = `Answer all 20 questions before submitting. ${missingCount.value} remaining.`
        return
      }

      missingAnswersError.value = null
      const submittedResult = await submitExam()
      if (submittedResult?.submitted && examId.value) {
        props.onNavigateToResult(examId.value)
      }
    }

    function handleSelect(questionId: string, option: ExamOptionKey) {
      if (missingAnswersError.value) {
        missingAnswersError.value = null
      }
      selectAnswer(questionId, option)
    }

    return () => {
      if (!examId.value) return renderCallout('Missing exam id.')
      if (isLoading.value && !exam.value) return renderCallout('Loading exam...', 'neutral')
      if (error.value && !exam.value) return renderCallout(error.value)
      if (!exam.value) return renderCallout('Loading exam...', 'neutral')

      return h('section', { class: 'page-shell section-stack' }, [
        h('header', { class: 'exam-hero' }, [
          h('div', { class: 'section-stack' }, [
            h('p', { class: 'eyebrow' }, 'Project Exam'),
            h('h1', projectName.value),
            h(
              'p',
              { class: 'section-lede' },
              'Answer all 20 questions before you submit. Grading details remain hidden until the backend processes your final submission.',
            ),
          ]),
          h('div', { class: 'exam-progress', 'aria-live': 'polite' }, [
            h('strong', String(answeredCount.value)),
            h('span', 'of 20 answered'),
            h('div', { class: 'exam-progress__track', 'aria-hidden': 'true' }, [
              h('span', {
                style: {
                  width: `${(answeredCount.value / 20) * 100}%`,
                },
              }),
            ]),
          ]),
        ]),
        h('div', { class: 'card' }, [
          h('div', { class: 'exam-summary' }, [
            h('div', { class: 'exam-summary__item' }, [
              h('span', { class: 'metric__label' }, 'Project'),
              h('strong', projectName.value),
            ]),
            h('div', { class: 'exam-summary__item' }, [
              h('span', { class: 'metric__label' }, 'Questions'),
              h('strong', `${totalCount.value} / 20 loaded`),
            ]),
            h('div', { class: 'exam-summary__item' }, [
              h('span', { class: 'metric__label' }, 'Progress'),
              h('strong', `${answeredCount.value} / 20 answered`),
            ]),
          ]),
        ]),
        error.value ? renderCallout(error.value) : null,
        totalCount.value !== 20
          ? renderCallout('This exam is not ready yet. Expected 20 questions before answering can begin.')
          : null,
        missingAnswersError.value ? renderCallout(missingAnswersError.value) : null,
        h(
          'div',
          { class: 'question-stack' },
          exam.value.questions.map((question: (typeof exam.value.questions)[number], index: number) =>
            h(ExamQuestion, {
              key: question.id,
              index,
              question,
              selectedOption: selectedAnswers.value[question.id],
              disabled: isSubmitting.value || isSubmittedStatus(exam.value?.status),
              onSelect: handleSelect,
            }),
          ),
        ),
        h('div', { class: 'card exam-submit-card' }, [
          h('div', { class: 'section-stack' }, [
            h('div', { class: 'callout callout--danger' }, 'Submission is final. You can submit this exam only once.'),
            h(SubmitExamButton, {
              answeredCount: answeredCount.value,
              totalCount: 20,
              disabled: totalCount.value !== 20,
              submitted: isSubmittedStatus(exam.value.status),
              isSubmitting: isSubmitting.value,
              onSubmit: handleSubmit,
            }),
            !allQuestionsAnswered.value && totalCount.value === 20
              ? h(
                  'p',
                  { class: 'field-hint' },
                  'Some answers are still missing. Finish every question before submitting.',
                )
              : null,
          ]),
        ]),
      ])
    }
  },
})
