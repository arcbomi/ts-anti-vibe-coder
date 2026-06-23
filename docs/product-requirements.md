# Product Requirements

## Product Goal

The platform verifies whether a user truly understands a Gitea repository. It does this by automatically reading the repository through a server Gitea userbot, generating code-understanding exam questions with AI, and grading an offline Friday exam.

A passing result means the user understands the repository code well enough to explain its structure, flow, and behavior.

## Target User

- Students who must prove they understand a repository they worked on.
- Learners who used AI coding tools and need to demonstrate real code comprehension.
- School staff who need a pass/fail verification result for a repository.
- Users scheduled to take an offline Friday exam at a specific location.

## Main User Flow

1. User logs in to the platform.
2. User enters a Gitea repository URL.
3. Platform shows instructions to add the server Gitea userbot as a collaborator.
4. User adds the bot in Gitea.
5. User clicks **"I already added the bot"**.
6. Backend checks whether the bot can access the repository.
7. Backend reads the repository automatically.
8. AI analyzes the repository code.
9. AI generates 20 English-only A/B/C/D questions.
10. User attends the offline Friday exam.
11. User answers the A/B/C/D questions.
12. Backend grades the exam.
13. If the user passes, the system marks that the user understands the repository.

## Repository Connection Flow

- The user submits only the Gitea repository URL.
- The platform displays the server Gitea userbot account that must be added as a collaborator.
- The user adds the bot in Gitea using Gitea's collaborator or project member settings.
- The user returns and clicks **"I already added the bot"**.
- The backend verifies access using the server bot credentials.
- The backend must not read repository code until access is confirmed.

## AI Analysis Flow

1. Repository access is confirmed.
2. Backend reads repository files automatically through the bot account.
3. Repository content is indexed for analysis.
4. AI receives the relevant codebase context.
5. AI generates exactly 20 English-only A/B/C/D questions.
6. Questions are saved directly for exam use.

The AI should focus on real code understanding, such as startup flow, route registration, handler behavior, service calls, request parsing, response handling, error handling, middleware impact, and frontend state flow.

## Exam Flow

- The exam happens offline on Friday at a specific location.
- The user receives A/B/C/D questions generated from their repository.
- The frontend must show only exam-safe question data.
- Correct answers and explanations must not be sent to the frontend during the exam.
- The user submits selected options.
- Backend grades the submitted answers.

## Pass/Fail Rule

The backend calculates the score and determines pass or fail according to the configured pass threshold. Backend grading is the source of truth.

If the user passes, the platform marks the user as understanding the repository. If the user fails, the user is not verified for that repository.

## Important Product Rules

1. User does not upload code manually.
2. User does not provide personal Gitea token.
3. User adds server Gitea userbot as collaborator.
4. User must click **"I already added the bot"**.
5. System checks bot access before reading repo.
6. Questions are English only.
7. No admin question review.
8. Backend grading is the source of truth.
9. Frontend must not receive correct answers during exam.
