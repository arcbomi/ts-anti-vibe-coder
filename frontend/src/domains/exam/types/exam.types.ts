export type Exam = {
  id: string
  status: 'created' | 'taking' | 'submitted'
}

export type ExamResult = {
  examId: string
  scorePercent: number
  passed: boolean
}
