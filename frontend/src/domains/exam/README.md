# Exam Domain

This domain handles the exam-taking flow and exam result display.

Responsibilities:
- Load exam questions.
- Show English-only A/B/C/D questions.
- Store selected answers.
- Submit answers to backend.
- Display backend-graded result.

Important rules:
- The frontend must not receive correct answers during the exam.
- The frontend must not calculate pass/fail locally.
- Backend grading is the source of truth.
- This domain should not depend on repository, analysis, or auth domain internals.
