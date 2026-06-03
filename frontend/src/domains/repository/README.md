# Repository Domain

This domain handles GitLab repository connection.

The user does not provide a GitLab token.

The user adds the platform GitLab bot account as a collaborator to their repository.

After that, the user clicks "I already added the bot."

The backend checks bot access and reads the repository automatically.

This domain should not depend on auth, analysis, question, or exam domains directly.
