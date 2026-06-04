import { apiClient } from '@/shared/api/client'
import type { ExamQuestion, OptionKey } from '@/domains/question/types/question.types'

type RawQuestionOptions = Record<OptionKey, string> | Record<string, string> | Array<{ key?: OptionKey; text?: string }>

type RawQuestion = {
  id?: string
  question_id?: string
  question: string
  options: RawQuestionOptions
  difficulty?: ExamQuestion['difficulty']
  sourceFilePath?: string
  source_file_path?: string
}

type RawQuestionsResponse = {
  questions: RawQuestion[]
}

function normalizeQuestion(question: RawQuestion): ExamQuestion {
  const options = Array.isArray(question.options)
    ? question.options.reduce<Record<string, string>>((acc, option, index) => {
        const key = option.key ?? (['A', 'B', 'C', 'D'] as const)[index] ?? 'A'
        acc[key] = option.text ?? ''
        return acc
      }, {})
    : question.options

  return {
    id: question.id ?? question.question_id ?? '',
    question: question.question,
    options: {
      A: options.A ?? '',
      B: options.B ?? '',
      C: options.C ?? '',
      D: options.D ?? '',
    },
    difficulty: question.difficulty,
    sourceFilePath: question.sourceFilePath ?? question.source_file_path,
  }
}

function normalizeQuestionsResponse(payload: RawQuestion[] | RawQuestionsResponse): ExamQuestion[] {
  const questions = Array.isArray(payload) ? payload : payload.questions

  return questions.map(normalizeQuestion)
}

export async function getExamQuestions(examId: string): Promise<ExamQuestion[]> {
  const payload = await apiClient.get<RawQuestion[] | RawQuestionsResponse>(`/exams/${examId}/questions`)
  return normalizeQuestionsResponse(payload)
}

export async function getAnalysisJobQuestions(analysisJobId: string): Promise<ExamQuestion[]> {
  const payload = await apiClient.get<RawQuestion[] | RawQuestionsResponse>(`/analysis-jobs/${analysisJobId}/questions`)
  return normalizeQuestionsResponse(payload)
}

export const questionApi = {
  getExamQuestions,
  getAnalysisJobQuestions,
  listForExam: async (examId: string) => ({ questions: await getExamQuestions(examId) }),
}
