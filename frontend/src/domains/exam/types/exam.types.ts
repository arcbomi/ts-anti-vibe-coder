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
  status: string
}

export interface SubmitExamResponse {
  examId: string
  submitted: boolean
}

export type RawExamQuestionOption = {
  key?: ExamOptionKey
  text?: string
}

export type RawExamQuestion = {
  id?: string
  question_id?: string
  question: string
  options: Record<string, string> | RawExamQuestionOption[]
  difficulty?: string
  sourceFilePath?: string
  source_file_path?: string
}

export type RawExam = {
  id?: string
  exam_id?: string
  status: ExamStatus | string
  scheduledAt?: string
  scheduled_at?: string
  startedAt?: string
  started_at?: string
  submittedAt?: string
  submitted_at?: string
  questions: RawExamQuestion[]
}

export type RawExamResult = {
  examId?: string
  exam_id?: string
  score: number
  totalQuestions?: number
  total_questions?: number
  correctCount?: number
  correct_count?: number
  passed: boolean
  passingScore?: number
  passing_score?: number
  status?: string
}

export type RawSubmitExamResponse = {
  examId?: string
  exam_id?: string
  submitted: boolean
}
