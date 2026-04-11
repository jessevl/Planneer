// API Routes for Planneer backend
//
// Custom API endpoints beyond PocketBase's built-in CRUD:
// - /health - Health check
// - /api/users/lookup - Find user by email (for invites)
// - /api/workspaces/{id}/members - List workspace members with user details
// - /api/workspaces/{id}/export - Export workspace data
// - /api/pages/{id}/export - Export single page to markdown
// - /api/search - Full-text search across tasks and pages
// - /api/pages/{id}/patch - Block-level page updates

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"

	"planneer/config"
)

var cachedConfigJSON []byte

// Shared HTTP client for Unsplash API calls — reuses TCP/TLS connections
var unsplashClient = &http.Client{Timeout: 15 * time.Second}

// RegisterRoutes sets up all custom API routes
func RegisterRoutes(app *pocketbase.PocketBase, se *core.ServeEvent) {
	// Pre-marshal config for maximum performance
	var err error
	cachedConfigJSON, err = json.Marshal(map[string]any{
		"isClosedBeta":      config.CurrentConfig.IsClosedBeta,
		"hasUnsplashConfig": config.CurrentConfig.UnsplashAccessKey != "",
	})
	if err != nil {
		log.Printf("Error marshaling config: %v", err)
	}

	// Health check
	se.Router.GET("/health", func(e *core.RequestEvent) error {
		return e.JSON(200, map[string]string{"status": "healthy"})
	})

	// App configuration (public)
	se.Router.GET("/api/config", func(e *core.RequestEvent) error {
		if cachedConfigJSON != nil {
			return e.Blob(200, "application/json", cachedConfigJSON)
		}
		return e.JSON(200, map[string]any{
			"isClosedBeta":      config.CurrentConfig.IsClosedBeta,
			"hasUnsplashConfig": config.CurrentConfig.UnsplashAccessKey != "",
		})
	})

	// Unsplash proxy (authenticated)
	se.Router.GET("/api/unsplash/search", func(e *core.RequestEvent) error {
		return handleUnsplashSearch(e, app)
	}).Bind(apis.RequireAuth())

	se.Router.POST("/api/pages/{pageId}/unsplash-cover", func(e *core.RequestEvent) error {
		return handleSetUnsplashCover(e, app)
	}).Bind(apis.RequireAuth())

	// User lookup by email (for workspace invites)
	se.Router.POST("/api/users/lookup", func(e *core.RequestEvent) error {
		return handleUserLookup(e, app)
	}).Bind(apis.RequireAuth())

	// Get workspace members with user details
	se.Router.GET("/api/workspaces/{workspaceId}/members", func(e *core.RequestEvent) error {
		return handleGetWorkspaceMembers(e, app)
	}).Bind(apis.RequireAuth())

	// Export workspace data
	se.Router.GET("/api/workspaces/{workspaceId}/export", func(e *core.RequestEvent) error {
		return ExportWorkspace(e, app)
	}).Bind(apis.RequireAuth())

	// Full-text search across tasks and pages
	se.Router.GET("/api/search", func(e *core.RequestEvent) error {
		return handleSearch(e, app)
	}).Bind(apis.RequireAuth())

	// Block-level patch for pages (bandwidth-efficient updates)
	se.Router.PATCH("/api/pages/{pageId}/patch", func(e *core.RequestEvent) error {
		return handlePagePatch(e, app)
	}).Bind(apis.RequireAuth())

	// Export single page to markdown
	se.Router.GET("/api/pages/{pageId}/export", func(e *core.RequestEvent) error {
		return ExportSinglePage(e, app)
	}).Bind(apis.RequireAuth())

	registerBooxRoutes(app, se)
}

// ============================================================================
// USER LOOKUP
// ============================================================================

func handleUserLookup(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Invalid request body", err)
	}
	if body.Email == "" {
		return e.BadRequestError("Email is required", nil)
	}

	user, err := app.FindAuthRecordByEmail("users", body.Email)
	if err != nil {
		return e.NotFoundError("User not found with that email", nil)
	}

	return e.JSON(200, map[string]any{
		"id":     user.Id,
		"email":  user.Email(),
		"name":   user.GetString("name"),
		"avatar": user.GetString("avatar"),
	})
}

// ============================================================================
// WORKSPACE MEMBERS
// ============================================================================

func handleGetWorkspaceMembers(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	workspaceId := e.Request.PathValue("workspaceId")
	if workspaceId == "" {
		return e.BadRequestError("Workspace ID is required", nil)
	}

	// Verify membership
	if _, err := app.FindFirstRecordByFilter("workspace_members",
		"workspace = {:wid} && user = {:uid}",
		map[string]any{"wid": workspaceId, "uid": e.Auth.Id}); err != nil {
		return e.ForbiddenError("You are not a member of this workspace", nil)
	}

	// Fetch members
	members, err := app.FindRecordsByFilter("workspace_members",
		"workspace = {:wid}", "-created", 0, 0, map[string]any{"wid": workspaceId})
	if err != nil {
		return e.InternalServerError("Failed to fetch members", err)
	}

	result := make([]map[string]any, 0, len(members))
	for _, m := range members {
		userId := m.GetString("user")
		var userInfo map[string]any
		if user, err := app.FindRecordById("users", userId); err == nil {
			userInfo = map[string]any{
				"id":     user.Id,
				"email":  user.Email(),
				"name":   user.GetString("name"),
				"avatar": user.GetString("avatar"),
			}
		}
		result = append(result, map[string]any{
			"id":        m.Id,
			"user":      userId,
			"workspace": workspaceId,
			"role":      m.GetString("role"),
			"created":   m.GetString("created"),
			"expand":    map[string]any{"user": userInfo},
		})
	}

	return e.JSON(200, result)
}

// ============================================================================
// FULL-TEXT SEARCH
// ============================================================================

func handleSearch(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	query := e.Request.URL.Query().Get("q")
	workspaceId := e.Request.URL.Query().Get("workspace")
	searchType := e.Request.URL.Query().Get("type") // "all", "tasks", "pages"
	limitStr := e.Request.URL.Query().Get("limit")

	if query == "" {
		return e.BadRequestError("Query parameter 'q' is required", nil)
	}
	if workspaceId == "" {
		return e.BadRequestError("Query parameter 'workspace' is required", nil)
	}

	// Verify workspace membership
	if _, err := app.FindFirstRecordByFilter("workspace_members",
		"workspace = {:wid} && user = {:uid}",
		map[string]any{"wid": workspaceId, "uid": e.Auth.Id}); err != nil {
		return e.ForbiddenError("You are not a member of this workspace", nil)
	}

	// Parse limit (default 20, max 100)
	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	if searchType == "" {
		searchType = "all"
	}

	results := map[string]any{
		"query": query,
		"tasks": []map[string]any{},
		"pages": []map[string]any{},
	}

	ftsQuery := escapeFTSQuery(query)

	// Search tasks
	if searchType == "all" || searchType == "tasks" {
		tasks := searchTasks(app, ftsQuery, workspaceId, limit)
		results["tasks"] = tasks
	}

	// Search pages
	if searchType == "all" || searchType == "pages" {
		pages := searchPages(app, ftsQuery, workspaceId, limit)
		results["pages"] = pages
	}

	return e.JSON(200, results)
}

func searchTasks(app *pocketbase.PocketBase, ftsQuery, workspaceId string, limit int) []map[string]any {
	var taskResults []struct {
		Id          string  `db:"id"`
		Title       string  `db:"title"`
		Description string  `db:"description"`
		Rank        float64 `db:"rank"`
	}

	err := app.DB().NewQuery(`
		SELECT t.id, t.title, t.description, bm25(tasks_fts) as rank
		FROM tasks_fts
		JOIN tasks t ON tasks_fts.id = t.id
		WHERE tasks_fts MATCH {:query}
		AND tasks_fts.workspace = {:workspace}
		ORDER BY rank
		LIMIT {:limit}
	`).Bind(map[string]any{
		"query":     ftsQuery,
		"workspace": workspaceId,
		"limit":     limit,
	}).All(&taskResults)

	if err != nil {
		log.Printf("Task search error: %v", err)
		return []map[string]any{}
	}

	tasks := make([]map[string]any, 0, len(taskResults))
	for _, r := range taskResults {
		if task, err := app.FindRecordById("tasks", r.Id); err == nil {
			tasks = append(tasks, map[string]any{
				"id":           task.Id,
				"title":        task.GetString("title"),
				"description":  task.GetString("description"),
				"dueDate":      task.GetString("dueDate"),
				"priority":     task.GetString("priority"),
				"parentPageId": task.GetString("parentPageId"),
				"completed":    task.GetBool("completed"),
				"rank":         r.Rank,
			})
		}
	}
	return tasks
}

func searchPages(app *pocketbase.PocketBase, ftsQuery, workspaceId string, limit int) []map[string]any {
	var pageResults []struct {
		Id      string  `db:"id"`
		Title   string  `db:"title"`
		Excerpt string  `db:"excerpt"`
		Rank    float64 `db:"rank"`
	}

	err := app.DB().NewQuery(`
		SELECT p.id, p.title, p.excerpt, bm25(pages_fts) as rank
		FROM pages_fts
		JOIN pages p ON pages_fts.id = p.id
		WHERE pages_fts MATCH {:query}
		AND pages_fts.workspace = {:workspace}
		ORDER BY rank
		LIMIT {:limit}
	`).Bind(map[string]any{
		"query":     ftsQuery,
		"workspace": workspaceId,
		"limit":     limit,
	}).All(&pageResults)

	if err != nil {
		log.Printf("Page search error: %v", err)
		return []map[string]any{}
	}

	pages := make([]map[string]any, 0, len(pageResults))
	for _, r := range pageResults {
		if page, err := app.FindRecordById("pages", r.Id); err == nil {
			pages = append(pages, map[string]any{
				"id":       page.Id,
				"title":    page.GetString("title"),
				"excerpt":  page.GetString("excerpt"),
				"icon":     page.GetString("icon"),
				"parentId": page.GetString("parentId"),
				"viewMode": page.GetString("viewMode"),
				"rank":     r.Rank,
			})
		}
	}
	return pages
}

// maxSearchQueryLength is the maximum allowed search query length to prevent abuse
const maxSearchQueryLength = 200

// escapeFTSQuery escapes special FTS5 characters and prepares the query
// for prefix matching (adds * to each term for partial matching).
//
// SECURITY: Escapes double quotes, strips FTS5 special characters ({, }, (, ), ^, :),
// filters empty terms, and enforces a maximum query length.
func escapeFTSQuery(query string) string {
	query = strings.TrimSpace(query)
	if query == "" {
		return query
	}

	// Enforce maximum query length to prevent abuse
	if len(query) > maxSearchQueryLength {
		query = query[:maxSearchQueryLength]
	}

	terms := strings.Fields(query)
	escapedTerms := make([]string, 0, len(terms))

	// FTS5 special characters to strip
	specialChars := strings.NewReplacer(
		`"`, `""`,
		"{", "",
		"}", "",
		"(", "",
		")", "",
		"^", "",
		":", "",
	)

	for _, term := range terms {
		term = specialChars.Replace(term)
		// Skip empty terms after stripping
		if term == "" {
			continue
		}
		escapedTerms = append(escapedTerms, `"`+term+`"*`)
	}

	if len(escapedTerms) == 0 {
		return ""
	}

	return strings.Join(escapedTerms, " ")
}

// ============================================================================
// PAGE PATCH (Block-level updates)
// ============================================================================

// applyTableRowChange merges a row into an AdvancedTable block's children.
// Key format: "tableId:row:rowId"
func applyTableRowChange(content map[string]json.RawMessage, tableId, rowId string, rowData json.RawMessage) {
	existingBlock, exists := content[tableId]
	if !exists {
		log.Printf("[PATCH] Table block %s not found for row update %s", tableId, rowId)
		return
	}

	var block map[string]any
	if err := json.Unmarshal(existingBlock, &block); err != nil {
		log.Printf("[PATCH] Failed to unmarshal table block %s: %v", tableId, err)
		return
	}

	// Navigate to value[0].children (table element's rows)
	value, ok := block["value"].([]any)
	if !ok || len(value) == 0 {
		log.Printf("[PATCH] Table block %s has invalid value structure", tableId)
		return
	}

	tableElement, ok := value[0].(map[string]any)
	if !ok {
		log.Printf("[PATCH] Table block %s has invalid table element", tableId)
		return
	}

	children, ok := tableElement["children"].([]any)
	if !ok {
		children = make([]any, 0)
	}

	// Parse the incoming row data
	var newRow map[string]any
	if err := json.Unmarshal(rowData, &newRow); err != nil {
		log.Printf("[PATCH] Failed to unmarshal row data for %s: %v", rowId, err)
		return
	}

	// Find and update existing row, or append new one
	found := false
	for i, child := range children {
		if row, ok := child.(map[string]any); ok {
			if row["id"] == rowId {
				children[i] = newRow
				found = true
				break
			}
		}
	}
	if !found {
		children = append(children, newRow)
	}

	tableElement["children"] = children
	value[0] = tableElement
	block["value"] = value

	// Marshal back to content
	if updated, err := json.Marshal(block); err == nil {
		content[tableId] = updated
	}
}

// applyTableMetaChange updates an AdvancedTable block's element props.
// Key format: "tableId:meta"
func applyTableMetaChange(content map[string]json.RawMessage, tableId string, metaData json.RawMessage) {
	existingBlock, exists := content[tableId]
	if !exists {
		log.Printf("[PATCH] Table block %s not found for meta update", tableId)
		return
	}

	var block map[string]any
	if err := json.Unmarshal(existingBlock, &block); err != nil {
		log.Printf("[PATCH] Failed to unmarshal table block %s: %v", tableId, err)
		return
	}

	// Navigate to value[0].props
	value, ok := block["value"].([]any)
	if !ok || len(value) == 0 {
		log.Printf("[PATCH] Table block %s has invalid value structure", tableId)
		return
	}

	tableElement, ok := value[0].(map[string]any)
	if !ok {
		log.Printf("[PATCH] Table block %s has invalid table element", tableId)
		return
	}

	// Parse the incoming props
	var newProps map[string]any
	if err := json.Unmarshal(metaData, &newProps); err != nil {
		log.Printf("[PATCH] Failed to unmarshal meta data for %s: %v", tableId, err)
		return
	}

	tableElement["props"] = newProps
	value[0] = tableElement
	block["value"] = value

	// Marshal back to content
	if updated, err := json.Marshal(block); err == nil {
		content[tableId] = updated
	}
}

// deleteTableRow removes a row from an AdvancedTable block's children.
// Key format: "tableId:row:rowId"
func deleteTableRow(content map[string]json.RawMessage, tableId, rowId string) {
	existingBlock, exists := content[tableId]
	if !exists {
		return
	}

	var block map[string]any
	if err := json.Unmarshal(existingBlock, &block); err != nil {
		return
	}

	value, ok := block["value"].([]any)
	if !ok || len(value) == 0 {
		return
	}

	tableElement, ok := value[0].(map[string]any)
	if !ok {
		return
	}

	children, ok := tableElement["children"].([]any)
	if !ok {
		return
	}

	// Filter out the deleted row
	newChildren := make([]any, 0, len(children))
	for _, child := range children {
		if row, ok := child.(map[string]any); ok {
			if row["id"] != rowId {
				newChildren = append(newChildren, row)
			}
		}
	}

	tableElement["children"] = newChildren
	value[0] = tableElement
	block["value"] = value

	if updated, err := json.Marshal(block); err == nil {
		content[tableId] = updated
	}
}

func handlePagePatch(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	pageId := e.Request.PathValue("pageId")
	if pageId == "" {
		return e.BadRequestError("Page ID is required", nil)
	}

	var body struct {
		Blocks      map[string]json.RawMessage `json:"blocks"`
		Deleted     []string                   `json:"deleted"`
		BlockOrders map[string]int             `json:"blockOrders"` // Block ID -> new order (for reordering without full content)
		Metadata    map[string]any             `json:"metadata"`
	}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Invalid request body", err)
	}

	page, err := app.FindRecordById("pages", pageId)
	if err != nil {
		return e.NotFoundError("Page not found", nil)
	}
	if page.GetBool("isReadOnly") && page.GetString("sourceOrigin") == booxSourceOrigin {
		return e.ForbiddenError("Mirrored BOOX notebooks are read-only", nil)
	}

	// Verify access
	if _, err := app.FindFirstRecordByFilter("workspace_members",
		"workspace = {:wid} && user = {:uid}",
		map[string]any{"wid": page.GetString("workspace"), "uid": e.Auth.Id}); err != nil {
		return e.ForbiddenError("You don't have access to this page", nil)
	}

	// Parse and update content
	var yooptaContent map[string]json.RawMessage

	// Read from content field
	if existing := page.GetString("content"); existing != "" {
		if err := json.Unmarshal([]byte(existing), &yooptaContent); err != nil {
			log.Printf("[PATCH] Warning: failed to parse existing content for page %s: %v", pageId, err)
		}
	}
	if yooptaContent == nil {
		yooptaContent = make(map[string]json.RawMessage)
	}

	// Yoopta format - merge blocks and handle granular table keys
	for k, v := range body.Blocks {
		// Check if this is a granular table key (Option C: Row-Level CRDT)
		if strings.Contains(k, ":row:") {
			// Format: "tableId:row:rowId" - merge row into table block
			parts := strings.Split(k, ":row:")
			if len(parts) == 2 {
				tableId := parts[0]
				rowId := parts[1]
				applyTableRowChange(yooptaContent, tableId, rowId, v)
				continue
			}
		} else if strings.HasSuffix(k, ":meta") {
			// Format: "tableId:meta" - update table element props
			tableId := strings.TrimSuffix(k, ":meta")
			applyTableMetaChange(yooptaContent, tableId, v)
			continue
		}

		// Regular block - merge directly
		yooptaContent[k] = v
	}

	// Apply order-only updates (update just meta.order in existing blocks)
	for blockId, newOrder := range body.BlockOrders {
		if existingBlock, exists := yooptaContent[blockId]; exists {
			var block map[string]any
			if err := json.Unmarshal(existingBlock, &block); err == nil {
				meta, ok := block["meta"].(map[string]any)
				if !ok {
					meta = make(map[string]any)
				}
				meta["order"] = newOrder
				block["meta"] = meta

				if updated, err := json.Marshal(block); err == nil {
					yooptaContent[blockId] = updated
				}
			}
		}
	}

	// Apply deletions (including granular table row deletions)
	for _, k := range body.Deleted {
		// Check if this is a granular table row deletion
		if strings.Contains(k, ":row:") {
			// Format: "tableId:row:rowId" - delete row from table
			parts := strings.Split(k, ":row:")
			if len(parts) == 2 {
				tableId := parts[0]
				rowId := parts[1]
				deleteTableRow(yooptaContent, tableId, rowId)
				continue
			}
		}
		// Regular block deletion
		delete(yooptaContent, k)
	}

	newContent, _ := json.Marshal(yooptaContent)
	page.Set("content", string(newContent))

	// Apply metadata
	allowedFields := map[string]bool{
		"title": true, "parentId": true, "icon": true, "color": true, "order": true,
		"viewMode": true, "childrenViewMode": true, "isExpanded": true, "excerpt": true,
		"collectionSortBy": true, "collectionSortDirection": true, "collectionGroupBy": true,
		// Task collection specific fields
		"sections": true, "tasksViewMode": true, "tasksGroupBy": true, "showCompletedTasks": true,
		// Saved views
		"savedViews": true, "activeSavedViewId": true,
	}

	// SECURITY: Validate parentId is in the same workspace to prevent cross-workspace reparenting
	if newParentId, ok := body.Metadata["parentId"]; ok {
		if parentIdStr, isStr := newParentId.(string); isStr && parentIdStr != "" {
			parentPage, err := app.FindRecordById("pages", parentIdStr)
			if err != nil || parentPage.GetString("workspace") != page.GetString("workspace") {
				return e.BadRequestError("Parent page must be in the same workspace", nil)
			}
		}
	}

	for k, v := range body.Metadata {
		if allowedFields[k] {
			page.Set(k, v)
		}
	}

	// Store patch for SSE injection
	log.Printf("[PATCH API] Storing %d blocks, %d blockOrders for page %s", len(body.Blocks), len(body.BlockOrders), pageId)
	MergePendingPatch(pageId, body.Blocks, body.Deleted, body.BlockOrders)

	if err := app.Save(page); err != nil {
		DeletePendingPatch(pageId)
		return e.InternalServerError("Failed to save page", err)
	}

	log.Printf("[PATCH API] Save completed for page %s, scheduling cleanup", pageId)

	// Delete pending patch after a short delay
	go func(id string) {
		time.Sleep(100 * time.Millisecond)
		DeletePendingPatch(id)
		log.Printf("[PATCH API] Cleaned up pending patch for page %s", id)
	}(pageId)

	response := page.PublicExport()
	// Remove large content fields from response - clients don't need them
	// They rely on SSE for content updates
	delete(response, "content")
	return e.JSON(200, response)
}

// ============================================================================
// UNSPLASH PROXY
// ============================================================================

func handleUnsplashSearch(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	query := strings.TrimSpace(e.Request.URL.Query().Get("query"))
	if query == "" || len(query) > 200 {
		return e.BadRequestError("Search query is required (max 200 characters)", nil)
	}

	page := e.Request.URL.Query().Get("page")
	perPage := e.Request.URL.Query().Get("per_page")
	orientation := e.Request.URL.Query().Get("orientation")

	// Validate per_page to prevent abuse of Unsplash rate limits
	if pp, err := strconv.Atoi(perPage); err != nil || pp < 1 || pp > 30 {
		perPage = "12"
	}
	// Validate page number
	if p, err := strconv.Atoi(page); err != nil || p < 1 || p > 100 {
		page = "1"
	}
	// Validate orientation
	switch orientation {
	case "landscape", "portrait", "squarish":
		// valid
	default:
		orientation = "landscape"
	}

	if config.CurrentConfig.UnsplashAccessKey == "" {
		return e.BadRequestError("Unsplash integration is not configured on the server", nil)
	}

	// Build Unsplash API URL
	apiUrl := fmt.Sprintf("https://api.unsplash.com/search/photos?query=%s&page=%s&per_page=%s&orientation=%s",
		url.QueryEscape(query),
		url.QueryEscape(page),
		url.QueryEscape(perPage),
		url.QueryEscape(orientation),
	)

	// Create request
	req, err := http.NewRequest("GET", apiUrl, nil)
	if err != nil {
		return e.InternalServerError("Failed to create Unsplash request", err)
	}

	// Add Authorization header and User-Agent
	req.Header.Set("Authorization", "Client-ID "+config.CurrentConfig.UnsplashAccessKey)
	req.Header.Set("User-Agent", "Planneer/1.0 (https://planneer.app)")

	// Execute request
	resp, err := unsplashClient.Do(req)
	if err != nil {
		return e.InternalServerError("Failed to execute Unsplash request", err)
	}
	defer resp.Body.Close()

	// SECURITY: Limit response body size to prevent OOM from malicious/compromised upstream
	const maxUnsplashResponseSize = 5 * 1024 * 1024 // 5MB
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxUnsplashResponseSize))
	if err != nil {
		return e.InternalServerError("Failed to read Unsplash response", err)
	}

	// Forward status code and body
	return e.Blob(resp.StatusCode, "application/json", body)
}

func handleSetUnsplashCover(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Authentication required", nil)
	}

	pageId := e.Request.PathValue("pageId")
	var body struct {
		DownloadUrl string `json:"downloadUrl"`
		Attribution string `json:"attribution"`
	}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Invalid request body", err)
	}

	// SECURITY: Prevent SSRF by validating the Unsplash URL
	if !strings.HasPrefix(body.DownloadUrl, "https://api.unsplash.com/photos/") {
		return e.BadRequestError("Invalid Unsplash download URL", nil)
	}

	if config.CurrentConfig.UnsplashAccessKey == "" {
		return e.BadRequestError("Unsplash integration is not configured on the server", nil)
	}

	// SECURITY: Verify user has access to the page
	// We check if the user is a member of the workspace the page belongs to
	page, err := app.FindRecordById("pages", pageId)
	if err != nil {
		return e.NotFoundError("Page not found", err)
	}

	workspaceId := page.GetString("workspace")
	if workspaceId == "" {
		return e.ForbiddenError("Page does not belong to a workspace", nil)
	}

	// Check workspace membership
	membership, _ := app.FindRecordsByFilter(
		"workspace_members",
		"workspace = {:wid} && user = {:uid}",
		"",
		1,
		0,
		map[string]any{"wid": workspaceId, "uid": e.Auth.Id},
	)

	if len(membership) == 0 {
		return e.ForbiddenError("You do not have permission to modify this page", nil)
	}

	// 1. Trigger Unsplash download tracking and get the actual image URL
	req, err := http.NewRequest("GET", body.DownloadUrl, nil)
	if err != nil {
		return e.InternalServerError("Failed to create Unsplash tracking request", err)
	}
	req.Header.Set("Authorization", "Client-ID "+config.CurrentConfig.UnsplashAccessKey)
	req.Header.Set("User-Agent", "Planneer/1.0 (https://planneer.app)")

	resp, err := unsplashClient.Do(req)
	if err != nil {
		log.Printf("[Unsplash] Tracking request failed for %s: %v", body.DownloadUrl, err)
		return e.InternalServerError("Failed to execute Unsplash tracking request", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Unsplash] Tracking request returned status %d for %s", resp.StatusCode, body.DownloadUrl)
		return e.InternalServerError(fmt.Sprintf("Unsplash tracking failed with status %d", resp.StatusCode), nil)
	}

	// Limit tracking response size to prevent OOM from compromised upstream
	const maxTrackingResponseSize = 64 * 1024 // 64KB
	var trackingData struct {
		Url string `json:"url"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxTrackingResponseSize)).Decode(&trackingData); err != nil {
		log.Printf("[Unsplash] Failed to parse tracking response: %v", err)
		return e.InternalServerError("Failed to parse Unsplash tracking response", err)
	}

	// SECURITY: Validate the tracked image URL as well
	if !strings.HasPrefix(trackingData.Url, "https://images.unsplash.com/") {
		log.Printf("[Unsplash] Invalid image URL returned: %s", trackingData.Url)
		return e.InternalServerError("Unsplash returned an invalid image URL", nil)
	}

	// 2. Download the actual image
	imgReq, err := http.NewRequest("GET", trackingData.Url, nil)
	if err != nil {
		return e.InternalServerError("Failed to create image download request", err)
	}
	imgReq.Header.Set("User-Agent", "Planneer/1.0 (https://planneer.app)")

	imgResp, err := unsplashClient.Do(imgReq)
	if err != nil {
		log.Printf("[Unsplash] Image download failed for %s: %v", trackingData.Url, err)
		return e.InternalServerError("Failed to download image from Unsplash", err)
	}
	defer imgResp.Body.Close()

	if imgResp.StatusCode != http.StatusOK {
		log.Printf("[Unsplash] Image download returned status %d for %s", imgResp.StatusCode, trackingData.Url)
		return e.InternalServerError(fmt.Sprintf("Image download failed with status %d", imgResp.StatusCode), nil)
	}

	// SECURITY: Limit download size to 10MB to prevent memory exhaustion
	const maxDownloadSize = 10 * 1024 * 1024 // 10MB
	data, err := io.ReadAll(io.LimitReader(imgResp.Body, maxDownloadSize))
	if err != nil {
		return e.InternalServerError("Failed to read image data", err)
	}

	if len(data) >= maxDownloadSize {
		return e.BadRequestError("Image is too large (max 10MB)", nil)
	}

	// SECURITY: Validate content type using actual bytes (more reliable than Content-Type header)
	detectedType := http.DetectContentType(data)
	if !strings.HasPrefix(detectedType, "image/") {
		return e.BadRequestError("Downloaded file is not a valid image", nil)
	}

	// Determine correct file extension from detected content type
	var ext string
	switch {
	case strings.HasPrefix(detectedType, "image/png"):
		ext = ".png"
	case strings.HasPrefix(detectedType, "image/gif"):
		ext = ".gif"
	case strings.HasPrefix(detectedType, "image/webp"):
		ext = ".webp"
	default:
		// Default to .jpg for image/jpeg and any other image/* types
		ext = ".jpg"
	}

	// 3. Update the page record
	// Create the file from the bytes with the correct extension
	file, err := filesystem.NewFileFromBytes(data, "unsplash-cover"+ext)
	if err != nil {
		log.Printf("[Unsplash] Failed to create file from bytes (%d bytes): %v", len(data), err)
		return e.InternalServerError("Failed to create file from download", err)
	}

	page.Set("coverImage", file)
	page.Set("coverGradient", "") // Clear gradient
	page.Set("coverAttribution", body.Attribution)

	if err := app.Save(page); err != nil {
		log.Printf("[Unsplash] Failed to save page %s (detected-type: %s, ext: %s, size: %d): %v", pageId, detectedType, ext, len(data), err)
		return e.InternalServerError(fmt.Sprintf("Failed to save page with new cover: %v", err), nil)
	}

	// Strip large content fields from response to save bandwidth
	response := page.PublicExport()
	delete(response, "content")
	return e.JSON(200, response)
}
