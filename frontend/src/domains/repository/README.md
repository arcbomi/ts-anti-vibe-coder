# Repository Domain

This domain handles GitLab repository connection.

The user does not provide a GitLab personal token.

The user adds the platform GitLab server userbot as a collaborator to their repository.

After that, the user clicks "I already added the bot."

The backend checks bot access and reads the repository automatically.

This domain should stay independent from auth, analysis, question, and exam domains.
