# Question Domain

This domain owns reusable question display UI.

It is used by the exam domain to show English-only A/B/C/D questions.

Important rule:
The question domain must not know the correct answer during exam mode.
The backend is responsible for grading.

This domain should not depend on repository, analysis, auth, or exam business logic directly.

## Responsibilities

- Display question text.
- Display A/B/C/D options.
- Handle selected option UI state.
- Return selected answers to parent domains.
- Load safe exam questions from the API.
- Show reusable question list, empty, loading, and error states when composed by parent domains.

## Security boundary

Exam question data must only contain safe display fields: `id`, `question`, `options`, optional `difficulty`, and optional `sourceFilePath`.
Do not add correct answers or explanations to exam-mode question types, API responses, stores, or components.
