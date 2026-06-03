# Exam Domain

This domain handles taking an exam and viewing results.

Rules:
- English-only A/B/C/D questions
- Backend grading is the source of truth
- Frontend must not know correct answers during the exam
- Offline exam every Friday (policy enforced by backend)

This domain should not depend on auth, repository, analysis, or question domains directly.
