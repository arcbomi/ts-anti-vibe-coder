CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  gitea_repo_url TEXT NOT NULL,
  gitea_project_path TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  bot_access_status TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_user_project ON repositories(user_id, gitea_project_path);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_repository_id ON analysis_jobs(repository_id);

CREATE TABLE IF NOT EXISTS generated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_generated_questions_analysis_job_id ON generated_questions(analysis_job_id);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_analysis_job_id ON questions(analysis_job_id);

CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY,
  user_id UUID,
  repository_id UUID,
  analysis_job_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  score INTEGER,
  passed BOOLEAN,
  passing_score INTEGER NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_exams_analysis_job_id ON exams(analysis_job_id);

CREATE TABLE IF NOT EXISTS exam_question_options (
  id UUID PRIMARY KEY,
  exam_id UUID NOT NULL,
  question_id UUID NOT NULL,
  display_option TEXT NOT NULL CHECK (display_option IN ('A', 'B', 'C', 'D')),
  original_option TEXT NOT NULL CHECK (original_option IN ('A', 'B', 'C', 'D')),
  option_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, question_id, display_option)
);
CREATE INDEX IF NOT EXISTS idx_exam_question_options_exam_id ON exam_question_options(exam_id);

CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY,
  exam_id UUID NOT NULL,
  question_id UUID NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, question_id),
  UNIQUE (exam_id, order_index)
);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_question_id ON exam_questions(question_id);

CREATE TABLE IF NOT EXISTS exam_answers (
  id UUID PRIMARY KEY,
  exam_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_answers_exam_id ON exam_answers(exam_id);
