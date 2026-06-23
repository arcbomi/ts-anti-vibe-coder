package tomorrow

import (
	"fmt"
	"net/url"
	"path"
	"regexp"
	"slices"
	"strings"

	"golang.org/x/net/html"
)

var (
	statusTexts = []string{
		"Project succeeded",
		"Project failed",
		"In progress",
		"Unavailable",
		"Missing audit",
		"Locked",
	}
	auditPattern = regexp.MustCompile(`(?i)\b\d+\s+peer audits?\s+required\b`)
)

func ParseProjects(profileHTML, baseURL, username string) ([]Project, error) {
	doc, err := html.Parse(strings.NewReader(profileHTML))
	if err != nil {
		return nil, fmt.Errorf("%w: parse html: %v", ErrProfileFormatChanged, err)
	}

	cardRoots := collectCardRoots(doc)
	if len(cardRoots) == 0 {
		return nil, fmt.Errorf("%w: no project cards found", ErrProfileFormatChanged)
	}

	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	username = firstNonEmpty(username, DefaultUsername)
	projects := make([]Project, 0, len(cardRoots))
	seen := make(map[string]struct{}, len(cardRoots))
	for _, root := range cardRoots {
		project, ok := extractProject(root, baseURL, username)
		if !ok {
			continue
		}
		if _, exists := seen[project.ID]; exists {
			continue
		}
		seen[project.ID] = struct{}{}
		projects = append(projects, project)
	}
	if len(projects) == 0 {
		return nil, fmt.Errorf("%w: project cards did not contain recognizable project data", ErrProfileFormatChanged)
	}
	return projects, nil
}

func collectCardRoots(root *html.Node) []*html.Node {
	seen := map[*html.Node]struct{}{}
	var roots []*html.Node
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node == nil {
			return
		}
		if node.Type == html.TextNode {
			status := matchStatus(node.Data)
			if status != "" {
				if cardRoot := findCardRoot(node.Parent); cardRoot != nil {
					if _, ok := seen[cardRoot]; !ok {
						seen[cardRoot] = struct{}{}
						roots = append(roots, cardRoot)
					}
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return roots
}

func findCardRoot(node *html.Node) *html.Node {
	var fallback *html.Node
	for current := node; current != nil; current = current.Parent {
		if current.Type != html.ElementNode {
			continue
		}
		if hasProjectRootHint(current) {
			return current
		}
		if fallback == nil && isContainerElement(current) {
			fallback = current
		}
	}
	return fallback
}

func hasProjectRootHint(node *html.Node) bool {
	if node == nil {
		return false
	}
	if strings.EqualFold(node.Data, "article") || strings.EqualFold(node.Data, "li") {
		return true
	}
	for _, attr := range node.Attr {
		if attr.Key == "class" || attr.Key == "id" || strings.HasPrefix(attr.Key, "data-") {
			value := strings.ToLower(attr.Val)
			if strings.Contains(value, "project") || strings.Contains(value, "card") || strings.Contains(value, "result") {
				return true
			}
		}
	}
	return false
}

func isContainerElement(node *html.Node) bool {
	switch node.Data {
	case "div", "section", "article", "li", "tr", "main":
		return true
	default:
		return false
	}
}

func extractProject(root *html.Node, baseURL, username string) (Project, bool) {
	status := extractStatus(root)
	if status == "" {
		return Project{}, false
	}

	repoURL := extractRepoURL(root, baseURL)
	name := extractProjectName(root)
	slug := extractSlug(root, repoURL, name)
	if slug == "" {
		return Project{}, false
	}
	if name == "" {
		name = slug
	}
	if repoURL == "" && baseURL != "" {
		repoURL = fmt.Sprintf("%s/git/%s/%s", baseURL, username, slug)
	}

	project := Project{
		ID:          slug,
		Slug:        slug,
		Name:        name,
		RepoURL:     repoURL,
		Status:      status,
		AuditText:   extractAuditText(root),
		IsSucceeded: normalizeSpace(status) == succeededStatusText,
	}
	return project, true
}

func extractStatus(root *html.Node) string {
	var status string
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if status != "" || node == nil {
			return
		}
		if node.Type == html.TextNode {
			status = matchStatus(node.Data)
			if status != "" {
				return
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return status
}

func extractProjectName(root *html.Node) string {
	type candidate struct {
		text  string
		score int
	}
	var candidates []candidate
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node == nil || node.Type != html.ElementNode {
			return
		}
		text := normalizeSpace(textContent(node))
		if isProjectNameCandidate(text) {
			switch node.Data {
			case "h1", "h2", "h3", "h4", "h5", "h6":
				candidates = append(candidates, candidate{text: text, score: 5})
			case "a":
				candidates = append(candidates, candidate{text: text, score: 4})
			case "strong", "b":
				candidates = append(candidates, candidate{text: text, score: 3})
			case "span", "div":
				candidates = append(candidates, candidate{text: text, score: 1})
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	if len(candidates) == 0 {
		return ""
	}
	slices.SortStableFunc(candidates, func(a, b candidate) int {
		if a.score == b.score {
			switch {
			case len(a.text) < len(b.text):
				return -1
			case len(a.text) > len(b.text):
				return 1
			default:
				return 0
			}
		}
		if a.score > b.score {
			return -1
		}
		return 1
	})
	return candidates[0].text
}

func isProjectNameCandidate(value string) bool {
	if value == "" {
		return false
	}
	lower := strings.ToLower(value)
	if matchStatus(value) != "" {
		return false
	}
	if auditPattern.MatchString(value) || strings.Contains(lower, "audit") {
		return false
	}
	if strings.Contains(lower, "profile") || strings.Contains(lower, "event") {
		return false
	}
	return true
}

func extractRepoURL(root *html.Node, baseURL string) string {
	var repoURL string
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if repoURL != "" || node == nil {
			return
		}
		if node.Type == html.ElementNode && node.Data == "a" {
			if href := getAttr(node, "href"); href != "" {
				if strings.Contains(href, "/git/") {
					repoURL = absolutizeURL(baseURL, href)
					return
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return repoURL
}

func extractSlug(root *html.Node, repoURL, name string) string {
	if repoURL != "" {
		if parsed, err := url.Parse(repoURL); err == nil {
			if slug := slugify(path.Base(parsed.Path)); slug != "" {
				return slug
			}
		}
	}

	var slug string
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if slug != "" || node == nil || node.Type != html.ElementNode {
			return
		}
		for _, attr := range node.Attr {
			if attr.Key == "href" {
				if candidate := slugFromHref(attr.Val); candidate != "" {
					slug = candidate
					return
				}
			}
			if strings.Contains(strings.ToLower(attr.Key), "slug") || strings.Contains(strings.ToLower(attr.Key), "project") {
				if candidate := slugify(attr.Val); candidate != "" {
					slug = candidate
					return
				}
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	if slug != "" {
		return slug
	}
	return slugify(name)
}

func extractAuditText(root *html.Node) string {
	var auditText string
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if auditText != "" || node == nil {
			return
		}
		if node.Type == html.TextNode {
			text := normalizeSpace(node.Data)
			switch {
			case auditPattern.MatchString(text):
				auditText = text
				return
			case strings.Contains(strings.ToLower(text), "audit"):
				auditText = text
				return
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(root)
	return auditText
}

func matchStatus(value string) string {
	normalized := normalizeSpace(value)
	for _, status := range statusTexts {
		if strings.Contains(normalized, status) {
			return status
		}
	}
	return ""
}

func normalizeSpace(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func textContent(node *html.Node) string {
	var parts []string
	var walk func(*html.Node)
	walk = func(current *html.Node) {
		if current == nil {
			return
		}
		if current.Type == html.TextNode {
			text := normalizeSpace(current.Data)
			if text != "" {
				parts = append(parts, text)
			}
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return strings.Join(parts, " ")
}

func getAttr(node *html.Node, key string) string {
	for _, attr := range node.Attr {
		if strings.EqualFold(attr.Key, key) {
			return strings.TrimSpace(attr.Val)
		}
	}
	return ""
}

func absolutizeURL(baseURL, href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	parsed, err := url.Parse(href)
	if err == nil && parsed.IsAbs() {
		return parsed.String()
	}
	baseParsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return href
	}
	ref, err := url.Parse(href)
	if err != nil {
		return href
	}
	return baseParsed.ResolveReference(ref).String()
}

func slugFromHref(href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	parsed, err := url.Parse(href)
	if err != nil {
		return ""
	}
	base := path.Base(strings.TrimRight(parsed.Path, "/"))
	if base == "" || base == "." || strings.Contains(base, "profile") {
		return ""
	}
	return slugify(base)
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	var b strings.Builder
	prevDash := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		case r == '-' || r == '_' || r == ' ':
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "" || slug == "git" || slug == "profile" {
		return ""
	}
	return slug
}
