DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'repositories'
      AND column_name = 'gitlab_repo_url'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'repositories'
      AND column_name = 'gitea_repo_url'
  ) THEN
    ALTER TABLE repositories RENAME COLUMN gitlab_repo_url TO gitea_repo_url;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'repositories'
      AND column_name = 'gitlab_project_path'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'repositories'
      AND column_name = 'gitea_project_path'
  ) THEN
    ALTER TABLE repositories RENAME COLUMN gitlab_project_path TO gitea_project_path;
  END IF;
END
$$;

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS tomorrow_audit_text TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_repositories_user_id
  ON repositories(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_user_project
  ON repositories(user_id, gitea_project_path);
