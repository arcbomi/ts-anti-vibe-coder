# Product Requirements: Codebase Understanding Verification Platform

## 1. Product Overview

The product is a codebase understanding verification platform for GitLab repositories. It verifies whether a user understands how their repository works.

The platform is not a normal quiz app. It creates an exam from the user's own GitLab codebase. The exam checks real understanding of program structure, runtime behavior, request flow, frontend/backend interaction, and module responsibilities.

The core product flow is:

1. The user logs in.
2. The user enters a GitLab repository URL.
3. The system asks the user to add the platform GitLab server userbot as a repository collaborator.
4. The user adds the bot in GitLab.
5. The user clicks **"I already added the bot."**
6. The backend checks whether the bot can access the repository.
7. If access is confirmed, the system reads the repository automatically.
8. AI analyzes the codebase.
9. AI generates exactly 20 English-only A/B/C/D questions.
10. The user takes an offline exam on Saturday.
11. The backend grades the answers.
12. If the user passes, the user is verified as understanding that repository.
13. If the user fails, the user is not verified yet.

## 2. Problem Statement

AI coding tools can help users generate code quickly. However, a user may submit or maintain code that they do not truly understand.

This creates a risk that the user cannot explain how the program starts, how requests move through the system, how frontend and backend parts connect, where a change should be made, or what would break if a file or function is removed.

The platform solves this by generating an exam from the user's own GitLab repository. The exam must test understanding of the actual codebase, not generic programming knowledge or shallow repository facts.

## 3. Target Users

The target users are:

- Students who must prove they understand a repository they worked on.
- Learners using AI coding tools who need to demonstrate real code comprehension.
- Instructors or school staff who need a pass/fail verification result for a specific repository.
- Program participants who must attend an offline Saturday exam and answer questions about their own codebase.

## 4. Main User Flow

The main user flow must work as follows:

1. User opens the website.
2. User logs in.
3. User enters a GitLab repository URL.
4. System shows this instruction: **"Please add our GitLab server userbot as a collaborator to your repository."**
5. User goes to GitLab and adds the platform GitLab server userbot as a collaborator.
6. User returns to the platform.
7. User clicks **"I already added the bot."**
8. Backend checks whether the GitLab bot can access the repository.
9. If bot access fails, the system shows an error and asks the user to check the collaborator settings.
10. If bot access succeeds, the system reads the repository automatically.
11. System starts an AI analysis job.
12. AI analyzes the repository structure and program logic.
13. AI generates exactly 20 English-only multiple-choice questions.
14. User is assigned to an offline Saturday exam.
15. User goes to the exam location on Saturday.
16. User answers A/B/C/D questions.
17. Backend grades the exam.
18. If the user passes, the platform marks the user as understanding this repository.
19. If the user fails, the platform marks the user as not verified yet.

## 5. GitLab Bot Collaboration Flow

The platform must use a server-managed GitLab userbot to access repositories.

The user must not upload code manually and must not provide a personal GitLab access token. The user only grants repository access by adding the platform GitLab server userbot as a collaborator.

The collaboration flow must be:

1. User submits a GitLab repository URL.
2. System displays the GitLab bot username and clear instructions to add it as a collaborator.
3. User adds the bot in GitLab using GitLab repository collaborator settings.
4. User returns to the platform.
5. User clicks **"I already added the bot."**
6. Backend checks access using the server bot credentials.
7. System continues only if the bot can access the repository.

The button **"I already added the bot"** is required. The system must not start repository reading before the user clicks this button and bot access is confirmed.

## 6. Repository Access Rules

The repository access rules are:

- User does not upload code manually.
- User does not provide a personal GitLab token.
- User only adds the platform GitLab server userbot as a collaborator.
- Backend must check bot access before reading repository code.
- System must not read the repository if bot access fails.
- If bot access fails, the system must show an error and ask the user to check collaborator settings.
- If bot access succeeds, the system reads the repository automatically.
- Repository reading is performed by the backend using the platform GitLab bot.
- The frontend must not receive repository secrets or bot credentials.

## 7. AI Analysis Requirement

After repository access is confirmed, the system must start an AI analysis job.

The AI analysis must inspect the repository to understand:

- How the program starts.
- How routes are registered.
- How HTTP routing, mux, or `net/http` is used when present.
- How request handlers work.
- How request data is parsed.
- How response data is returned.
- How middleware works.
- How services call repositories or database logic.
- How frontend code calls backend APIs.
- How hooks, stores, and components work when present.
- Which modules own specific responsibilities.
- Where a new feature should be added.
- What would break if an important function, file, or module is removed.

The AI analysis must focus on code behavior and architecture. It must not focus on shallow repository metadata.

## 8. Question Generation Rules

The AI must generate exactly 20 questions for each exam.

All generated questions must follow these rules:

- Questions must be English only.
- Questions must be multiple-choice questions.
- Each question must have exactly four answer choices: A, B, C, and D.
- Each question must have exactly one correct answer.
- Generated questions are used directly in the exam.
- There is no admin question review in the current version.
- The frontend must not know the correct answers during the exam.
- Backend grading is the source of truth.

Questions should test real codebase understanding. Good question topics include:

- How the program starts.
- How routes are registered.
- How mux or `net/http` is used.
- How request handlers work.
- How request data is parsed.
- How response data is returned.
- How middleware works.
- How services call repositories or database logic.
- How frontend calls backend.
- How hooks, stores, and components work.
- Where a new feature should be added.
- What would break if a function or file is removed.
- Which module owns a specific responsibility.

Questions must avoid shallow topics. Bad question topics include:

- Repository name.
- Programming language name.
- README title.
- Package version.
- Exact variable name trivia.
- UI color.
- Simple syntax trivia.

## 9. Offline Saturday Exam Flow

The exam is an offline exam that happens on Saturday.

The exam flow must be:

1. After question generation, the user is assigned to a Saturday offline exam.
2. User goes to the exam location on Saturday.
3. User receives the 20 generated A/B/C/D questions.
4. User answers each question by selecting A, B, C, or D.
5. Frontend or exam interface submits the selected answers without exposing correct answers.
6. Backend grades the submitted answers.
7. System records a pass or fail result for the user and repository.

Exam requirements:

- Exam type: offline.
- Exam date: Saturday.
- Question count: 20.
- Question language: English only.
- Question format: A/B/C/D multiple choice.
- Passing score: configurable, default 70%.
- Result: pass or fail.

## 10. Pass/Fail Rules

The backend must grade the exam and decide the result.

The default passing score is 70%. Because there are 20 questions, the default passing threshold is 14 correct answers out of 20. The passing score must be configurable.

Pass means:

- The user is verified as understanding this repository.
- The platform marks the user-repository verification status as passed.

Fail means:

- The user is not verified yet.
- The platform marks the user-repository verification status as failed or not verified.

Only backend grading determines the final result. The frontend must not determine pass/fail status by itself.

## 11. Security and Privacy Rules

The platform must protect repository access and exam integrity.

Security and privacy rules:

- Users must not provide personal GitLab access tokens.
- Users must not upload code manually.
- Repository access must happen through the platform GitLab server userbot only.
- Backend must verify bot access before reading code.
- Bot credentials must be stored only in backend-controlled secure configuration.
- Bot credentials must never be exposed to the frontend.
- Correct answers must not be exposed to the frontend during the exam.
- Backend grading must be the source of truth.
- The system should only read repository data needed for analysis and question generation.
- The system should not make repository changes.
- The system should not commit code to the user's repository.
- The system should not disclose repository content to unrelated users.

## 12. Non-Goals

The following items are not part of the current version:

- No admin question review.
- No manual code upload.
- No user GitLab personal access token.
- No open-ended written answers.
- No automatic certificate design required in MVP.
- No plagiarism detection in MVP.
- No GitHub support in MVP.
- No frontend folder structure design in this requirements document.
- No backend implementation design in this requirements document.

## 13. MVP Scope

The MVP must include:

- User login.
- GitLab repository URL submission.
- Instruction to add the platform GitLab server userbot as a collaborator.
- Required **"I already added the bot"** confirmation button.
- Backend bot access check.
- Error state when bot access fails.
- Automatic repository reading after access is confirmed.
- AI repository analysis job.
- Generation of exactly 20 English-only A/B/C/D questions.
- Offline Saturday exam assignment.
- Exam answer submission.
- Backend grading.
- Configurable passing score with a default of 70%.
- Pass/fail result for the user and repository.
- Verification status that marks a passing user as understanding the repository.

The MVP must not include admin question review. Generated questions are used directly.

## 14. Future Improvements

The following ideas may be considered later, but they are not MVP requirements:

- Tomorrow School account login.
- Tomorrow School SSO.
- Certificate or badge after passing.
- Class or team management.
- Retake rules.
- Stronger anti-cheating system.
- Question difficulty balancing.
- Support GitHub later.
