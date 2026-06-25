export const QUESTION_COUNT = 20;
export const QUESTION_OPTION_KEYS = ["A", "B", "C", "D"] as const;
export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type QuestionOptionKey = (typeof QUESTION_OPTION_KEYS)[number];
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export type GeneratedQuestionInput = {
  question: string;
  options: Record<string, string>;
  correct_option: string;
  explanation: string;
  difficulty: string;
  source_file_path: string;
};

export type SaveGeneratedQuestionsRequest = {
  analysis_job_id: string;
  user_id?: string;
  repository_id?: string;
  project_slug?: string;
  repo_url?: string;
  questions: GeneratedQuestionInput[];
};

export type SaveGeneratedQuestionsResponse = {
  saved_count: number;
};

export type GeneratedQuestionRecord = {
  id: string;
  analysisJobId: string;
  question: string;
  options: Record<QuestionOptionKey, string>;
  correctOption: QuestionOptionKey;
  explanation: string;
  difficulty: QuestionDifficulty;
  sourceFilePath: string;
  createdAt: string;
};

export type ExamQuestionOptionRecord = {
  id: string;
  examId: string;
  questionId: string;
  displayOption: QuestionOptionKey;
  originalOption: QuestionOptionKey;
  optionText: string;
};

export type PublicQuestionDto = {
  id: string;
  question: string;
  options: Record<string, string>;
  difficulty?: string;
  source_file_path?: string;
};

export type QuestionsResponse = {
  id: string;
  analysis_job_id?: string;
  exam_id?: string;
  questions_count: number;
  questions: PublicQuestionDto[];
};

export type AnswerKeyDto = {
  question_id: string;
  correct_option: string;
  explanation: string;
};

export type AnswerKeyResponse = {
  answers: AnswerKeyDto[];
};
