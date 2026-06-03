package worker

import (
	"path/filepath"
	"strings"
	"unicode/utf8"
)

const MaxRepositoryFileSize = 300 * 1024

type RepositoryFile struct {
	Path    string
	Size    int
	Content string
}

type RepositoryFilter struct {
	MaxFileSize int
}

func NewRepositoryFilter(maxFileSize int) RepositoryFilter {
	if maxFileSize <= 0 {
		maxFileSize = MaxRepositoryFileSize
	}
	return RepositoryFilter{MaxFileSize: maxFileSize}
}

func (f RepositoryFilter) ShouldRead(path string, size int) bool {
	clean := strings.TrimPrefix(filepath.ToSlash(path), "/")
	if clean == "" || isIgnoredPath(clean) {
		return false
	}
	if size > 0 && size > f.MaxFileSize {
		return false
	}
	return looksUsefulForAI(clean)
}

func (f RepositoryFilter) AcceptContent(path string, content []byte) bool {
	if !f.ShouldRead(path, len(content)) || len(content) > f.MaxFileSize {
		return false
	}
	return utf8.Valid(content) && !looksBinary(content)
}

func isIgnoredPath(path string) bool {
	p := strings.TrimPrefix(filepath.ToSlash(path), "/")
	base := filepath.Base(p)
	if p == ".env" || strings.HasSuffix(p, "/.env") || base == "id_rsa" {
		return true
	}
	if strings.HasSuffix(p, ".pem") || strings.HasSuffix(p, ".key") {
		return true
	}
	ignoredDirs := []string{".git", "node_modules", "vendor", "dist", "build", "coverage", ".cache"}
	for _, part := range strings.Split(p, "/") {
		for _, ignored := range ignoredDirs {
			if part == ignored {
				return true
			}
		}
	}
	return false
}

func looksUsefulForAI(path string) bool {
	base := strings.ToLower(filepath.Base(path))
	if strings.HasPrefix(base, ".") && base != ".gitignore" {
		return false
	}
	allowedExts := map[string]struct{}{
		".go": {}, ".ts": {}, ".tsx": {}, ".js": {}, ".jsx": {}, ".py": {}, ".rb": {}, ".java": {}, ".kt": {}, ".rs": {}, ".php": {}, ".cs": {}, ".cpp": {}, ".c": {}, ".h": {}, ".hpp": {}, ".swift": {}, ".sql": {}, ".graphql": {}, ".proto": {}, ".yaml": {}, ".yml": {}, ".json": {}, ".toml": {}, ".md": {}, ".txt": {}, ".html": {}, ".css": {}, ".scss": {},
	}
	_, ok := allowedExts[strings.ToLower(filepath.Ext(path))]
	return ok
}

func looksBinary(content []byte) bool {
	limit := len(content)
	if limit > 8000 {
		limit = 8000
	}
	for _, b := range content[:limit] {
		if b == 0 {
			return true
		}
	}
	return false
}
