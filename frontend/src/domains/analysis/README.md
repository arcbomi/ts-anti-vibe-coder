# Analysis Domain

This domain handles AI analysis job progress.

It is responsible for:
- Loading analysis job status
- Polling job progress
- Showing analysis progress UI
- Showing failed/completed state

It is not responsible for:
- GitLab repository connection
- Question rendering
- Exam taking
- Backend grading

Analysis statuses:
- pending
- checking_bot_access
- reading_repository
- indexing_code
- analyzing_code
- generating_questions
- saving_questions
- completed
- failed
