# Question Service

This service stores and serves AI-generated exam questions.

## Responsibilities

- Save generated questions from AI Analysis Service.
- Serve safe public questions to frontend.
- Hide correct answers during exam.
- Provide answer keys only to internal backend services.
- Randomize question and option order for exam mode.

## Rules

- Questions are English only.
- Each exam uses 20 A/B/C/D questions.
- No admin review exists.
- Frontend must never receive `correct_option` or `explanation` during exam.

## API Safety

Public exam endpoints return only question text, shuffled A/B/C/D options, and difficulty. The
internal answer-key endpoint requires internal service authentication and is intended for the
Exam Service only.
