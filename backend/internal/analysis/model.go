package analysis

import "encoding/json"

// RepositoryInput is the platform-side input used to analyze a user-submitted
// GitLab repository. It represents repository data that has already been read
// safely by the platform bot; this service never mutates the user repository.
type RepositoryInput struct {
	UserID         string           `json:"user_id"`
	RepositoryID   string           `json:"repository_id"`
	GitLabRepoURL  string           `json:"gitlab_repository_url"`
	Branch         string           `json:"branch_name"`
	RepositoryTree []string         `json:"repository_file_tree"`
	Files          []RepositoryFile `json:"selected_source_files"`
}

type RepositoryFile struct {
	Path    string `json:"path"`
	Size    int    `json:"size"`
	Content string `json:"content"`
}

type CodeIndex struct {
	UserID         string        `json:"user_id"`
	RepositoryID   string        `json:"repository_id"`
	GitLabRepoURL  string        `json:"gitlab_repository_url"`
	Branch         string        `json:"branch_name"`
	RepositoryTree []string      `json:"repository_file_tree"`
	SelectedFiles  []FileSummary `json:"selected_source_files"`
}

type FileSummary struct {
	Path    string `json:"path"`
	Size    int    `json:"size"`
	Summary string `json:"summary"`
	Excerpt string `json:"excerpt"`
}

type GeneratedQuestion struct {
	Question       string `json:"question"`
	OptionA        string `json:"option_a"`
	OptionB        string `json:"option_b"`
	OptionC        string `json:"option_c"`
	OptionD        string `json:"option_d"`
	CorrectOption  string `json:"correct_option"`
	Explanation    string `json:"explanation"`
	Difficulty     string `json:"difficulty"`
	SourceFilePath string `json:"source_file_path"`
}

type GenerationResult struct {
	Analysis  json.RawMessage     `json:"analysis"`
	Questions []GeneratedQuestion `json:"questions"`
}
