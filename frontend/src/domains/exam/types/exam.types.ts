export type ExamStatus = 'scheduled' | 'in_progress' | 'submitted' | 'passed' | 'failed'

export type ExamOptionKey = 'A' | 'B' | 'C' | 'D'

export interface ExamQuestionOption {
  key: ExamOptionKey
  text: string
}

export interface ExamQuestion {
  id: string
  question: string
  options: ExamQuestionOption[]
}

export interface Exam {
  id: string
  status: ExamStatus
  scheduledAt?: string
  startedAt?: string
  submittedAt?: string
  questions: ExamQuestion[]
}

export interface ExamAnswer {
  questionId: string
  selectedOption: ExamOptionKey
}

export interface SubmitExamRequest {
  answers: ExamAnswer[]
}

export interface ExamResult {
  examId: string
  score: number
  totalQuestions: number
  correctCount: number
  passed: boolean
  passingScore: number
  status: 'passed' | 'failed'
}
