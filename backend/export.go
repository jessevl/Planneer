// Export functionality for workspace data
//
// Provides CSV (tasks only) and Markdown (ZIP with individual files) export formats.
// Also provides single-page export to Markdown.

package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// SINGLE PAGE EXPORT
// ============================================================================

// ExportSinglePage handles the /api/pages/{pageId}/export endpoint
// Returns the page content as Markdown
func ExportSinglePage(e *core.RequestEvent, app core.App) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	pageId := e.Request.PathValue("pageId")

	// Find the page
	page, err := app.FindRecordById("pages", pageId)
	if err != nil {
		return e.NotFoundError("Page not found", nil)
	}

	// Verify workspace membership
	workspaceId := page.GetString("workspace")
	if _, err := app.FindFirstRecordByFilter("workspace_members",
		"workspace = {:wid} && user = {:uid}",
		map[string]any{"wid": workspaceId, "uid": e.Auth.Id}); err != nil {
		return e.ForbiddenError("You are not a member of this workspace", nil)
	}

	// Build markdown content
	markdown := buildPageMarkdown(page)
	title := page.GetString("title")
	if title == "" {
		title = "Untitled"
	}
	safeName := sanitizeFilename(title)

	e.Response.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	e.Response.Header().Set("Content-Disposition",
		safeContentDisposition(safeName+".md"))
	return e.Blob(200, "text/markdown", []byte(markdown))
}

// ============================================================================
// EXPORT HANDLER
// ============================================================================

// ExportWorkspace handles the /api/workspaces/{workspaceId}/export endpoint
func ExportWorkspace(e *core.RequestEvent, app core.App) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	workspaceId := e.Request.PathValue("workspaceId")
	format := e.Request.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}

	// Verify workspace membership
	if _, err := app.FindFirstRecordByFilter("workspace_members",
		"workspace = {:wid} && user = {:uid}",
		map[string]any{"wid": workspaceId, "uid": e.Auth.Id}); err != nil {
		return e.ForbiddenError("You are not a member of this workspace", nil)
	}

	// Get workspace info
	workspace, err := app.FindRecordById("workspaces", workspaceId)
	if err != nil {
		return e.NotFoundError("Workspace not found", nil)
	}
	workspaceName := workspace.GetString("name")

	// Fetch data based on format
	safeName := strings.ReplaceAll(workspaceName, " ", "_")

	switch format {
	case "csv":
		// Need tasks and task pages (viewMode='tasks') for CSV
		tasks, _ := app.FindRecordsByFilter("tasks", "workspace = {:wid}", "-created", 0, 0,
			map[string]any{"wid": workspaceId})
		taskPages, _ := app.FindRecordsByFilter("pages", "workspace = {:wid} && viewMode = 'tasks'", "-created", 0, 0,
			map[string]any{"wid": workspaceId})
		return exportTasksCSV(e, safeName, tasks, taskPages)

	case "markdown":
		// All pages for Markdown export (notes, collections, whiteboards)
		pages, _ := app.FindRecordsByFilter("pages", "workspace = {:wid}", "-created", 0, 0,
			map[string]any{"wid": workspaceId})
		return exportMarkdownZip(e, safeName, pages)

	default:
		return e.BadRequestError("Invalid format. Use: csv or markdown", nil)
	}
}

// ============================================================================
// FORMAT-SPECIFIC EXPORTS
// ============================================================================

// exportTasksCSV exports tasks as a single CSV file
func exportTasksCSV(e *core.RequestEvent, safeName string, tasks, taskPages []*core.Record) error {
	csv := buildTasksCSV(tasks, taskPages)

	e.Response.Header().Set("Content-Type", "text/csv")
	e.Response.Header().Set("Content-Disposition",
		safeContentDisposition(safeName+"_tasks_"+time.Now().Format("2006-01-02")+".csv"))
	return e.Blob(200, "text/csv", []byte(csv))
}

// exportMarkdownZip exports pages as individual .md files in a ZIP, preserving hierarchy as folders
func exportMarkdownZip(e *core.RequestEvent, safeName string, pages []*core.Record) error {
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	// Build page map and find root pages
	pageMap := make(map[string]*core.Record)
	for _, p := range pages {
		pageMap[p.Id] = p
	}

	// Build path for each page (folder structure based on hierarchy)
	pagePaths := make(map[string]string)
	var buildPath func(page *core.Record) string
	buildPath = func(page *core.Record) string {
		if path, exists := pagePaths[page.Id]; exists {
			return path
		}

		title := sanitizeFilename(page.GetString("title"))
		if title == "" {
			title = "Untitled"
		}

		parentId := page.GetString("parentId")
		if parentId == "" {
			pagePaths[page.Id] = title
			return title
		}

		parent, exists := pageMap[parentId]
		if !exists {
			pagePaths[page.Id] = title
			return title
		}

		parentPath := buildPath(parent)
		path := parentPath + "/" + title
		pagePaths[page.Id] = path
		return path
	}

	// Process all pages
	for _, page := range pages {
		// Skip daily notes - they go in a special folder
		if page.GetBool("isDailyNote") {
			dailyDate := page.GetString("dailyNoteDate")
			if dailyDate == "" {
				dailyDate = "undated"
			}
			path := "Journal/" + dailyDate + ".md"

			content := buildPageMarkdown(page)
			if w, err := zipWriter.Create(path); err == nil {
				w.Write([]byte(content))
			}
			continue
		}

		// Build path for regular pages
		basePath := buildPath(page)

		// Check if this page has children (is a collection)
		hasChildren := false
		for _, other := range pages {
			if other.GetString("parentId") == page.Id {
				hasChildren = true
				break
			}
		}

		var path string
		if hasChildren {
			// Collection: create folder with index.md
			path = basePath + "/index.md"
		} else {
			// Regular page: just .md file
			path = basePath + ".md"
		}

		content := buildPageMarkdown(page)
		if w, err := zipWriter.Create(path); err == nil {
			w.Write([]byte(content))
		}
	}

	zipWriter.Close()

	e.Response.Header().Set("Content-Type", "application/zip")
	e.Response.Header().Set("Content-Disposition",
		safeContentDisposition(safeName+"_pages_"+time.Now().Format("2006-01-02")+".zip"))
	return e.Blob(200, "application/zip", buf.Bytes())
}

// sanitizeFilename removes characters that are invalid in filenames.
//
// SECURITY: Also strips control characters (\n, \r, \0, etc.) to prevent
// header injection and filesystem issues.
func sanitizeFilename(name string) string {
	// Strip control characters first (prevents header injection)
	var cleaned strings.Builder
	for _, r := range name {
		if r >= 32 && r != 127 { // skip control chars and DEL
			cleaned.WriteRune(r)
		}
	}
	result := cleaned.String()

	// Remove or replace filesystem-invalid characters
	invalid := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "-")
	}
	// Trim spaces and dots from ends
	result = strings.Trim(result, " .")
	// Limit length
	if len(result) > 100 {
		result = result[:100]
	}
	if result == "" {
		result = "export"
	}
	return result
}

// safeContentDisposition builds a Content-Disposition header value that is safe
// for non-ASCII filenames using RFC 5987 encoding (filename*=UTF-8”).
func safeContentDisposition(filename string) string {
	// ASCII fallback: replace non-ASCII with underscores
	var asciiFallback strings.Builder
	for _, r := range filename {
		if r >= 32 && r < 127 {
			asciiFallback.WriteRune(r)
		} else {
			asciiFallback.WriteRune('_')
		}
	}
	// RFC 5987 percent-encoded version
	encoded := url.PathEscape(filename)
	return fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, asciiFallback.String(), encoded)
}

// buildPageMarkdown creates markdown content for a single page
func buildPageMarkdown(page *core.Record) string {
	var sb strings.Builder

	// Title as H1
	title := page.GetString("title")
	if title != "" {
		sb.WriteString("# " + title + "\n\n")
	}

	// Content (for notes and collections)
	if content := page.GetString("content"); content != "" {
		sb.WriteString(yooptaToMarkdown(content))
	}

	return sb.String()
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// escapeCSV escapes a value for CSV output
func escapeCSV(value string) string {
	if strings.ContainsAny(value, ",\"\n") {
		return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
	}
	return value
}

// ============================================================================
// CSV BUILDER
// ============================================================================

func buildTasksCSV(tasks []*core.Record, taskPages []*core.Record) string {
	pageMap := make(map[string]string)
	for _, p := range taskPages {
		pageMap[p.Id] = p.GetString("title")
	}

	var sb strings.Builder
	sb.WriteString("Title,Description,Due Date,Priority,Task List,Completed,Completed At,Subtasks\n")

	for _, t := range tasks {
		taskListName := pageMap[t.GetString("parentPageId")]
		subtasksStr := formatSubtasks(t.Get("subtasks"))

		completed := "No"
		if t.GetBool("completed") {
			completed = "Yes"
		}

		sb.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s\n",
			escapeCSV(t.GetString("title")),
			escapeCSV(t.GetString("description")),
			t.GetString("dueDate"),
			t.GetString("priority"),
			escapeCSV(taskListName),
			completed,
			t.GetString("completedAt"),
			escapeCSV(subtasksStr),
		))
	}

	return sb.String()
}

func formatSubtasks(subtasksRaw any) string {
	if subtasksRaw == nil {
		return ""
	}
	subtasks, ok := subtasksRaw.([]any)
	if !ok {
		return ""
	}

	var parts []string
	for _, s := range subtasks {
		if sm, ok := s.(map[string]any); ok {
			check := "☐"
			if completed, _ := sm["completed"].(bool); completed {
				check = "☑"
			}
			title, _ := sm["title"].(string)
			parts = append(parts, check+" "+title)
		}
	}
	return strings.Join(parts, "; ")
}

// ============================================================================
// YOOPTA TO MARKDOWN CONVERSION
// ============================================================================

// yooptaToMarkdown converts Yoopta JSON content to Markdown
func yooptaToMarkdown(contentJSON string) string {
	var content map[string]any
	if err := json.Unmarshal([]byte(contentJSON), &content); err != nil {
		return ""
	}

	// Convert to slice for sorting
	type block struct {
		order int
		data  map[string]any
	}
	var blocks []block

	for _, v := range content {
		if b, ok := v.(map[string]any); ok {
			order := 0
			if meta, ok := b["meta"].(map[string]any); ok {
				if o, ok := meta["order"].(float64); ok {
					order = int(o)
				}
			}
			blocks = append(blocks, block{order: order, data: b})
		}
	}

	sort.Slice(blocks, func(i, j int) bool {
		return blocks[i].order < blocks[j].order
	})

	var lines []string
	for _, b := range blocks {
		blockType, _ := b.data["type"].(string)
		value, _ := b.data["value"].([]any)

		// Get depth for indentation
		depth := 0
		if meta, ok := b.data["meta"].(map[string]any); ok {
			if d, ok := meta["depth"].(float64); ok {
				depth = int(d)
			}
		}
		indent := strings.Repeat("  ", depth)

		text := extractSlateText(value)

		switch blockType {
		case "HeadingOne":
			lines = append(lines, "# "+text)
		case "HeadingTwo":
			lines = append(lines, "## "+text)
		case "HeadingThree":
			lines = append(lines, "### "+text)
		case "Paragraph":
			lines = append(lines, text)
		case "BulletedList":
			lines = append(lines, indent+"- "+text)
		case "NumberedList":
			lines = append(lines, indent+"1. "+text)
		case "TodoList":
			checked := "[ ]"
			// Check in value[0].props.checked (Yoopta structure)
			if len(value) > 0 {
				if firstEl, ok := value[0].(map[string]any); ok {
					if props, ok := firstEl["props"].(map[string]any); ok {
						if c, ok := props["checked"].(bool); ok && c {
							checked = "[x]"
						}
					}
				}
			}
			lines = append(lines, indent+"- "+checked+" "+text)
		case "Blockquote":
			lines = append(lines, "> "+text)
		case "Code":
			lines = append(lines, "```\n"+text+"\n```")
		case "Divider":
			lines = append(lines, "---")
		default:
			if text != "" {
				lines = append(lines, text)
			}
		}
	}

	return strings.Join(lines, "\n\n")
}

// extractSlateText extracts plain text from Slate-style value array
func extractSlateText(value []any) string {
	var parts []string

	for _, node := range value {
		if n, ok := node.(map[string]any); ok {
			if children, ok := n["children"].([]any); ok {
				for _, child := range children {
					if c, ok := child.(map[string]any); ok {
						if text, ok := c["text"].(string); ok {
							// Apply formatting
							if bold, _ := c["bold"].(bool); bold {
								text = "**" + text + "**"
							}
							if italic, _ := c["italic"].(bool); italic {
								text = "*" + text + "*"
							}
							if code, _ := c["code"].(bool); code {
								text = "`" + text + "`"
							}
							if strike, _ := c["strikethrough"].(bool); strike {
								text = "~~" + text + "~~"
							}
							parts = append(parts, text)
						}
					}
				}
			}
		}
	}

	return strings.Join(parts, "")
}
