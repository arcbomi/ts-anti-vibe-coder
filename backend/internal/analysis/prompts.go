package analysis

import "encoding/json"

func BuildRepositoryAnalysisPrompt(payload string) string {
	return `# Agent 7: AI Repository Analysis Agent

## Context

This agent is for the exam platform's AI analysis service.

It does not analyze the backend code of this platform itself.

It analyzes the GitLab repository submitted by the user.

The user will enter a GitLab repository URL, add the platform GitLab userbot as a collaborator, and click "I already added the bot."

After the backend confirms that the bot has access, this agent receives the user's repository code and analyzes it for exam question generation.

The purpose is to understand the user's project well enough to generate questions that test whether the user truly understands their own repository.

## Task

Analyze the user's GitLab repository and understand how the submitted project works.

This analysis will be used by the exam service to generate 20 English-only A/B/C/D questions.

## Responsibilities

- Analyze the GitLab repository submitted by the user.
- Do not analyze this exam platform's own backend repository.
- Detect the submitted project's language.
- Detect the submitted project's framework.
- Find the submitted project's entry points.
- Find important folders and modules.
- Find routes, handlers, services, stores, hooks, components, or CLI commands depending on the project type.
- Understand the real program behavior.
- Understand how data moves through the user's project.
- Understand how the project handles errors.
- Create a structured summary for the question generator.

## Input

The JSON payload below contains:

- User ID
- Repository ID
- GitLab repository URL
- Branch name
- Repository file tree
- Selected source files from the user's repository

## Output

Return only a JSON object in this shape:

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
    "How request data is parsed",
    "How frontend state moves from hook to component"
  ]
}

## Focus Areas

Focus on the actual functionality of the user's project.

Example analysis topics:

- How the submitted program starts.
- How the HTTP server is created.
- How mux, chi, gin, fiber, net/http, express, or another router is used.
- How routes are registered.
- How handlers receive requests.
- How handlers call service functions.
- How request bodies are parsed.
- How responses are returned.
- How errors are handled.
- How database access is separated from business logic.
- How frontend components, hooks, stores, and API clients work together.
- How a user action in the frontend reaches backend logic.
- How CLI commands are registered if the project is a CLI tool.
- How library functions are exposed if the project is a library.

## Important Rule

This agent analyzes the repository submitted by the user for exam generation.

It must not assume the repository is this platform's own backend code.

It must work for different kinds of user projects:

- Go backend
- React frontend
- Fullstack app
- CLI tool
- Library
- Small school project
- Open-source project

## Bad Behavior

Do not do this:

- Do not analyze the exam platform backend itself.
- Do not generate questions yet.
- Do not focus only on README.
- Do not ask shallow project metadata questions.
- Do not assume every repository is a Go backend.
- Do not assume every project uses mux or net/http.

## Good Behavior

Do this:

- Read the user's repository structure.
- Detect what kind of project it is.
- Understand how the user's code works.
- Extract functional behavior.
- Prepare analysis for the question generator.
- Keep source file paths for every important claim.

Repository payload:
` + payload
}

func BuildQuestionGenerationPrompt(analysis json.RawMessage) string {
	return `Generate exactly 20 English-only multiple-choice questions for an offline codebase understanding exam from this repository analysis. Return JSON object {"questions":[...]} only. Each question must have question, option_a, option_b, option_c, option_d, correct_option (A/B/C/D), explanation, difficulty, source_file_path. There must be exactly one correct option.

Questions must test real code understanding from the repository analysis. Avoid shallow metadata questions about the repository name, language name, README title, package version, exact variable-name trivia, UI color, or simple syntax trivia.

Analysis:
` + string(analysis)
}
