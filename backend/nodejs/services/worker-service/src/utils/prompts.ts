export function buildRepositoryAnalysisPrompt(payload: string): string {
  return `# Agent 7: AI Repository Analysis Agent

Analyze the user-submitted repository described below and return JSON only.

The response shape must be:
{
  "repository_summary": "Short summary of what the user's project does.",
  "project_type": "backend | frontend | fullstack | cli | library | unknown",
  "languages": ["Go", "TypeScript"],
  "frameworks": ["net/http", "React"],
  "entry_points": [
    {
      "file_path": "cmd/server/main.go",
      "description": "Starts the HTTP server."
    }
  ],
  "important_modules": [
    {
      "file_path": "internal/user/handler.go",
      "responsibility": "Handles user-related HTTP requests."
    }
  ],
  "code_flows": [
    {
      "name": "Create user flow",
      "steps": [
        "HTTP request reaches route",
        "Handler parses request body",
        "Service validates data",
        "Repository writes to database",
        "Handler returns JSON response"
      ],
      "source_files": [
        "internal/server/router.go",
        "internal/user/handler.go",
        "internal/user/service.go"
      ]
    }
  ],
  "question_topics": [
    "How routes are registered",
    "How handlers call services",
    "How request data is parsed"
  ]
}

Repository payload:
${payload}`;
}

export function buildQuestionGenerationPrompt(analysisPayload: string): string {
  return `Generate exactly 20 English-only multiple-choice questions from the repository analysis below.

Return JSON only in this shape:
{
  "questions": [
    {
      "question": "Question text",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correct_option": "A",
      "explanation": "Explanation",
      "difficulty": "easy | medium | hard",
      "source_file_path": "path/to/file"
    }
  ]
}

Rules:
- Return exactly 20 items.
- Each question must be answerable from the supplied repository analysis.
- Use only English.
- Each question must have exactly one correct answer.

Repository analysis:
${analysisPayload}`;
}
