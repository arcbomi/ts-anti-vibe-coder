# Repository Domain

This domain handles Gitea repository connection.

The user does not provide a Gitea personal token.

The user adds the platform Gitea server userbot as a collaborator to their repository.

After that, the user clicks "I already added the bot."

The backend checks bot access and reads the repository automatically.

This domain should stay independent from auth, analysis, question, and exam domains.
