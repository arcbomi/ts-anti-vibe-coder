# GitLab Reader Service

This service reads GitLab repositories through the platform GitLab server userbot.

Users do not provide personal GitLab tokens.

Flow:
1. User enters GitLab repository URL.
2. User adds the platform GitLab bot as collaborator.
3. User clicks "I already added the bot."
4. This service checks bot access.
5. If access is granted, this service creates an analysis job.
6. The AI worker later analyzes the repository and generates English-only exam questions.

This service does not generate questions.
This service does not grade exams.
This service only handles repository connection, bot access checking, safe file reading, and queue job creation.

## Endpoints

- `POST /repositories` stores a normalized GitLab repository URL for the authenticated user with `bot_access_status = unknown`.
- `POST /repositories/{id}/check-bot-access` checks whether the configured server bot token can access the repository.
- `POST /repositories/{id}/start-analysis` creates a pending analysis job and publishes it to the shared analysis queue.
- `GET /repositories/{id}` returns repository metadata and bot access status.

## Safety rules

The reader never asks for or accepts user GitLab tokens. Repository access is performed only with `GITLAB_BOT_TOKEN`.

The safe file filter skips secrets, private keys, generated folders, dependency folders, cache folders, large files, binary files, images, archives, database files, and logs before any repository content is sent to AI workers.
