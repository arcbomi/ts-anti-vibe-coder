export type OptionKey = 'A' | 'B' | 'C' | 'D'

export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface QuestionOptions {
  A: string
  B: string
  C: string
  D: string
}

export interface ExamQuestion {
  id: string
  question: string
  options: QuestionOptions
  difficulty?: QuestionDifficulty
  sourceFilePath?: string
}

export type Question = ExamQuestion
