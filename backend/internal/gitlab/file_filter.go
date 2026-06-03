package gitlab

import (
	"bytes"
	"path/filepath"
	"strings"
)

const DefaultMaxFileSizeBytes = 204800

type FileFilter struct {
	MaxFileSizeBytes int
}

func NewFileFilter(maxFileSizeBytes int) FileFilter {
	if maxFileSizeBytes <= 0 {
		maxFileSizeBytes = DefaultMaxFileSizeBytes
	}
	return FileFilter{MaxFileSizeBytes: maxFileSizeBytes}
}

func (f FileFilter) ShouldReadPath(filePath string) bool {
	p := normalizePath(filePath)
	if p == "" || strings.HasSuffix(p, "/") {
		return false
	}
	if isIgnoredPath(p) || hasSkippedExtension(p) {
		return false
	}
	if isUsefulFile(p) {
		return true
	}
	return false
}

func (f FileFilter) ShouldReadContent(content []byte) bool {
	if len(content) == 0 {
		return true
	}
	if f.MaxFileSizeBytes > 0 && len(content) > f.MaxFileSizeBytes {
		return false
	}
	return !bytes.Contains(content[:min(len(content), 8000)], []byte{0})
}

func normalizePath(filePath string) string {
	p := filepath.ToSlash(strings.TrimSpace(filePath))
	p = strings.TrimPrefix(p, "/")
	return p
}

func isIgnoredPath(p string) bool {
	name := strings.ToLower(filepath.Base(p))
	lower := strings.ToLower(p)
	if name == ".env" || strings.HasPrefix(name, ".env.") || name == "id_rsa" || name == "id_ed25519" {
		return true
	}
	if strings.HasPrefix(name, "secrets.") || strings.HasSuffix(name, ".secret") {
		return true
	}
	ignoredDirs := []string{".git", "node_modules", "vendor", "dist", "build", "coverage", ".cache", ".next", ".nuxt", "target", "bin", "obj", "tmp", "logs"}
	parts := strings.Split(lower, "/")
	for _, part := range parts[:max(len(parts)-1, 0)] {
		for _, dir := range ignoredDirs {
			if part == dir {
				return true
			}
		}
	}
	ignoredSuffixes := []string{".pem", ".key", ".p12", ".crt", ".der", ".log", ".lock"}
	for _, suffix := range ignoredSuffixes {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	return false
}

func hasSkippedExtension(p string) bool {
	skip := map[string]struct{}{
		".png": {}, ".jpg": {}, ".jpeg": {}, ".gif": {}, ".webp": {}, ".svg": {}, ".ico": {},
		".mp4": {}, ".mov": {}, ".zip": {}, ".tar": {}, ".gz": {}, ".rar": {}, ".7z": {},
		".db": {}, ".sqlite": {}, ".pdf": {}, ".exe": {}, ".dll": {}, ".so": {},
	}
	_, ok := skip[strings.ToLower(filepath.Ext(p))]
	return ok
}

func isUsefulFile(p string) bool {
	lower := strings.ToLower(p)
	base := strings.ToLower(filepath.Base(p))
	if base == "readme.md" || base == "go.mod" || base == "package.json" || base == "dockerfile" || base == "docker-compose.yml" {
		return true
	}
	if strings.HasPrefix(lower, "docs/") && strings.HasSuffix(lower, ".md") {
		return true
	}
	if strings.HasPrefix(lower, "cmd/") || strings.HasPrefix(lower, "internal/") || strings.HasPrefix(lower, "pkg/") {
		return strings.HasSuffix(lower, ".go")
	}
	if strings.HasPrefix(lower, "src/") {
		sourceExts := []string{".tsx", ".ts", ".jsx", ".js"}
		for _, ext := range sourceExts {
			if strings.HasSuffix(lower, ext) {
				return true
			}
		}
	}
	keywords := []string{"route", "handler", "service", "model", "store", "hook", "page"}
	for _, keyword := range keywords {
		if strings.Contains(lower, keyword) {
			return hasSourceExtension(lower)
		}
	}
	return hasSourceExtension(lower) && !strings.Contains(lower, "/testdata/")
}

func hasSourceExtension(p string) bool {
	exts := []string{".go", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml"}
	for _, ext := range exts {
		if strings.HasSuffix(p, ext) {
			return true
		}
	}
	return false
}
